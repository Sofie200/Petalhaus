// Adapter for the shipping service (PostNord).
// This is the ONLY file that knows PostNord: the API key, URLs, service codes and PostNord's response format.
// The rest of the shop only sees OUR model: a list of service points, and delivery estimates.
//
// TIMEOUT AND ERRORS – the common requirement:
//   - Every call goes through fetchWithRetry: timeout per attempt + retries on temporary errors (429, 5xx)
//   - PostNord's answer is validated with Zod before the shop uses it – broken entries are skipped
//   - The route catches errors and answers 502 with a clear message (shipping-routes.js)
//
// Checked against PostNord's developer portal:
//   - Service points: GET /rest/businesslocation/v5/servicepoints/nearest/byaddress (returnType is mandatory)
//   - Transit time:   GET /rest/transport/v2/transittime/addresstoaddress (startTime is LOCAL time, no zone)

import { z } from "zod";
import { fetchWithRetry } from "./_lib/fetchWithRetry.js";

const BASE_URL = process.env.POSTNORD_BASE_URL ?? "https://atapi2.postnord.com"; // sandbox – production: https://api2.postnord.com
const API_KEY = process.env.POSTNORD_API_KEY ?? "";
const TIMEOUT_MS = 8000;
const COUNTRY = "SE";

// PostNord's service codes for our two delivery options (from the transit time docs)
export const SERVICES = {
    servicePoint: { code: "19", name: "MyPack Collect" }, // pick up at a service point (ombud)
    home: { code: "17", name: "MyPack Home" },            // delivered to the door
};

function requireKey() {
    if (!API_KEY) {
        throw new Error("PostNord is not configured. Fill in POSTNORD_API_KEY in .env.");
    }
}

// PostNord only accepts the key as a query parameter, ?apikey=...
// (fetchWithRetry hides it in its error messages, so it never ends up in the log)
function buildUrl(path, params) {
    const url = new URL(path, BASE_URL);
    for (const [key, value] of Object.entries({ ...params, apikey: API_KEY })) {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

/* --- 1. SERVICE POINTS --- */

// Validate PostNord's answer. passthrough(): extra fields are allowed, we just don't use them.
const PostNordAddress = z
    .object({
        streetName: z.string().optional(),
        streetNumber: z.coerce.string().optional(),
        postalCode: z.coerce.string(),
        city: z.string(),
    })
    .passthrough();

const PostNordServicePoint = z
    .object({
        servicePointId: z.coerce.string().min(1),
        name: z.string().min(1),
        visitingAddress: PostNordAddress,
        routeDistance: z.number().optional(), // metres
        coordinates: z
            .array(z.object({ northing: z.number(), easting: z.number() }).passthrough())
            .optional(),
    })
    .passthrough();

// The list can come in two shapes, depending on the API version:
//   { servicePointInformationResponse: { servicePoints: [...] } }   (older)
//   { servicePoints: [...] }                                       (newer)
// Both become just the list.
const PostNordServicePointResponse = z
    .union([
        z
            .object({
                servicePointInformationResponse: z
                    .object({ servicePoints: z.array(z.unknown()).default([]) })
                    .passthrough(),
            })
            .passthrough(),
        z.object({ servicePoints: z.array(z.unknown()).default([]) }).passthrough(),
    ])
    .transform((body) => body.servicePointInformationResponse?.servicePoints ?? body.servicePoints);

/**
 * The nearest service points to an address. postalCode is required, street and city make it more exact.
 * @param {{ postalCode: string, streetName?: string, streetNumber?: string, city?: string, limit?: number }} address
 * @returns {Promise<Array<{ id: string, name: string, address: string, postalCode: string, city: string, distanceMeters: number | null, coordinates: { lat: number, lng: number } | null }>>}
 */
export async function getNearestServicePoints({ postalCode, streetName, streetNumber, city, limit = 5 }) {
    requireKey();

    const url = buildUrl("/rest/businesslocation/v5/servicepoints/nearest/byaddress", {
        returnType: "json", // mandatory according to the docs
        countryCode: COUNTRY,
        postalCode,
        streetName,
        streetNumber,
        city,
        numberOfServicePoints: limit,
        context: "optionalservicepoint", // recommended for checkouts: active service points that take deliveries
    });

    const response = await fetchWithRetry(url, { timeoutMs: TIMEOUT_MS });
    const body = await response.json();

    // 1. The envelope must look right – otherwise PostNord has changed something, and we stop here
    const envelope = PostNordServicePointResponse.safeParse(body);
    if (!envelope.success) {
        console.error("[SHIPPING] Unexpected service point response:", z.prettifyError(envelope.error));
        throw new Error("PostNord answered in an unexpected format");
    }

    // 2. Validate each service point, skip the broken ones (same idea as the product import)
    const servicePoints = [];
    for (const raw of envelope.data) {
        const result = PostNordServicePoint.safeParse(raw);
        if (!result.success) {
            console.warn("[SHIPPING] Skipping service point:", z.prettifyError(result.error));
            continue;
        }

        // PostNord's model → our model
        const sp = result.data;
        const street = [sp.visitingAddress.streetName, sp.visitingAddress.streetNumber].filter(Boolean).join(" ");
        const coordinate = sp.coordinates?.[0];

        servicePoints.push({
            id: sp.servicePointId,
            name: sp.name,
            address: street,
            postalCode: sp.visitingAddress.postalCode,
            city: sp.visitingAddress.city,
            distanceMeters: sp.routeDistance ?? null,
            coordinates: coordinate ? { lat: coordinate.northing, lng: coordinate.easting } : null,
        });
    }

    return servicePoints;
}

/* --- 2. DELIVERY TIME --- */

// startTime is "local date time" without a zone, e.g. "2026-10-27T22:39".
// The server runs in UTC on Vercel, so we convert to Swedish time ourselves.
function swedishLocalTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Stockholm",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// One entry per service VARIANT: the basic service (e.g. 19 = PostNord Service Point),
// with or without additional services (e.g. F1 = SameDay). We want the plain, bookable one.
// Checked against a real sandbox response:
//   { service: { basicServiceCode: "19", additionalServices?: [...] },
//     isBookable: true, errorMessage?: "...",
//     estimatedTimeOfArrival?: { dateOfDeparture: "2026-10-28", timeOfArrival: "2026-10-29T18:00:00", ... } }
const PostNordTransitTime = z
    .object({
        service: z
            .object({
                basicServiceCode: z.coerce.string().min(1),
                name: z.string().optional(),
                additionalServices: z.array(z.unknown()).optional(),
            })
            .passthrough(),
        isBookable: z.boolean().optional(),
        errorMessage: z.string().optional(),
        // Only present when the variant is bookable
        estimatedTimeOfArrival: z
            .object({
                dateOfDeparture: z.iso.date(),
                timeOfArrival: z.iso.datetime({ local: true }), // "2026-10-29T18:00:00", no zone
            })
            .passthrough()
            .optional(),
    })
    .passthrough()
    // PostNord's model → our model
    .transform((t) => ({
        code: t.service.basicServiceCode,
        hasAddons: (t.service.additionalServices?.length ?? 0) > 0,
        bookable: t.isBookable !== false && !t.errorMessage,
        departure: t.estimatedTimeOfArrival?.dateOfDeparture ?? null,
        arrival: t.estimatedTimeOfArrival?.timeOfArrival ?? null,
    }));

// Whole days between two "YYYY-MM-DD" dates
function daysBetween(from, to) {
    return Math.round((Date.parse(to) - Date.parse(from)) / (24 * 60 * 60 * 1000));
}

// The list of transit times – at the top level, or inside an object
const PostNordTransitResponse = z
    .union([
        z.array(z.unknown()),
        z.object({ transitTimes: z.array(z.unknown()) }).passthrough(),
        z.object({ transitTimeResponse: z.object({ transitTimes: z.array(z.unknown()) }).passthrough() }).passthrough(),
    ])
    .transform((body) => (Array.isArray(body) ? body : body.transitTimes ?? body.transitTimeResponse.transitTimes));

/**
 * Estimated delivery for BOTH our options, in one call to PostNord.
 * startTime = now: the parcel is assumed to be handed over to PostNord when the customer orders.
 * @param {{ fromPostalCode: string, toPostalCode: string }} route
 * @returns {Promise<{ servicePoint: { transitDays: number | null, deliveryDate: string | null } | null, home: { transitDays: number | null, deliveryDate: string | null } | null }>}
 */
export async function getDeliveryEstimates({ fromPostalCode, toPostalCode }) {
    requireKey();

    const url = buildUrl("/rest/transport/v2/transittime/addresstoaddress", {
        startTime: swedishLocalTime(),
        serviceCodes: [SERVICES.servicePoint.code, SERVICES.home.code].join(","),
        originPostalCode: fromPostalCode,
        originCountryCode: COUNTRY,
        destinationPostalCode: toPostalCode,
        destinationCountryCode: COUNTRY,
    });

    const response = await fetchWithRetry(url, { timeoutMs: TIMEOUT_MS });
    const body = await response.json();

    const envelope = PostNordTransitResponse.safeParse(body);
    if (!envelope.success) {
        console.error("[SHIPPING] Unexpected transit time response:", JSON.stringify(body).slice(0, 1000));
        throw new Error("PostNord answered in an unexpected format");
    }

    // Validate each entry, keep the plain, bookable variant per service code
    const byCode = new Map();
    for (const raw of envelope.data) {
        const result = PostNordTransitTime.safeParse(raw);
        if (!result.success) {
            console.warn("[SHIPPING] Skipping transit time:", JSON.stringify(raw).slice(0, 300));
            continue;
        }
        const t = result.data;
        if (t.hasAddons || !t.bookable) continue; // a variant with addons, or not offered for this route
        if (!t.arrival) {
            console.warn("[SHIPPING] Bookable, but no time of arrival:", JSON.stringify(raw).slice(0, 500));
            continue;
        }
        if (!byCode.has(t.code)) byCode.set(t.code, t);
    }

    const toEstimate = (code) => {
        const t = byCode.get(code);
        if (!t) return null;
        const deliveryDate = t.arrival.slice(0, 10); // "2026-10-29T18:00:00" → "2026-10-29"
        return {
            deliveryDate,
            transitDays: t.departure ? daysBetween(t.departure, deliveryDate) : null,
        };
    };

    return {
        servicePoint: toEstimate(SERVICES.servicePoint.code),
        home: toEstimate(SERVICES.home.code),
    };
}