// Adapter for the shipping service (PostNord).
// This is the ONLY file that knows PostNord: the API key, URLs, service codes and PostNord's response format.
// The rest of the shop only sees OUR model: a list of service points, and a delivery estimate.
//
// TIMEOUT AND ERRORS – the common requirement:
//   - Every call goes through fetchWithRetry: timeout per attempt + retries on temporary errors (429, 5xx)
//   - PostNord's answer is validated with Zod – broken service points are skipped, not shown
//   - The route catches errors and answers 502 with a clear message (shipping-routes.js)

import { z } from "zod";
import { fetchWithRetry } from "./_lib/fetchWithRetry.js";

const BASE_URL = process.env.POSTNORD_BASE_URL ?? "https://api2.postnord.com"; // sandbox: https://atapi2.postnord.com
const API_KEY = process.env.POSTNORD_API_KEY ?? "";
const TIMEOUT_MS = 8000;
const COUNTRY = "SE";

// PostNord's service codes for our two delivery options.
// Check them against your agreement in the developer portal if PostNord answers with an unknown service.
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
        returnType: "json",
        countryCode: COUNTRY,
        postalCode,
        streetName,
        streetNumber,
        city,
        numberOfServicePoints: limit,
        context: "optionalservicepoint", // only active service points that can receive deliveries
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

// The transit time response differs a bit between API versions and agreements, so the schema is loose:
// we need EITHER a number of days OR a delivery date. Log the raw answer the first time and adjust if needed.
const PostNordTransitTime = z
    .object({
        transitTimeInDays: z.coerce.number().int().nonnegative().optional(),
        deliveryDate: z.string().optional(),
        deliveryTime: z.string().optional(),
    })
    .passthrough()
    .refine((t) => t.transitTimeInDays !== undefined || t.deliveryDate || t.deliveryTime, {
        message: "No transit time or delivery date in the answer",
    });

const PostNordTransitResponse = z
    .object({
        transitTimeResponse: z
            .object({ transitTimes: z.array(PostNordTransitTime).min(1) })
            .passthrough(),
    })
    .passthrough();

/**
 * Estimated delivery from our warehouse to the customer's postal code.
 * @param {{ fromPostalCode: string, toPostalCode: string, service: "servicePoint" | "home" }} route
 * @returns {Promise<{ transitDays: number | null, deliveryDate: string | null }>}
 */
export async function getDeliveryEstimate({ fromPostalCode, toPostalCode, service }) {
    requireKey();

    const serviceCode = SERVICES[service]?.code;
    if (!serviceCode) throw new Error(`Unknown shipping service: ${service}`);

    // Check this path in the developer portal (transit time) – like the service points, it may differ per API version
    const url = buildUrl("/rest/transport/v1/transittime/getTransitTimeInformation.json", {
        startTime: new Date().toISOString(),
        serviceCode,
        fromAddressPostalCode: fromPostalCode,
        fromAddressCountryCode: COUNTRY,
        toAddressPostalCode: toPostalCode,
        toAddressCountryCode: COUNTRY,
    });

    const response = await fetchWithRetry(url, { timeoutMs: TIMEOUT_MS });
    const body = await response.json();

    const result = PostNordTransitResponse.safeParse(body);
    if (!result.success) {
        console.error("[SHIPPING] Unexpected transit time response:", z.prettifyError(result.error));
        throw new Error("PostNord answered in an unexpected format");
    }

    // PostNord's model → our model
    const first = result.data.transitTimeResponse.transitTimes[0];
    const date = first.deliveryDate ?? first.deliveryTime ?? null;

    return {
        transitDays: first.transitTimeInDays ?? null,
        deliveryDate: date ? date.slice(0, 10) : null, // "2026-10-29T16:00:00" → "2026-10-29"
    };
}