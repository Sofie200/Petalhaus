import { Router } from "express";
import { z } from "zod";
import { pool } from "../_db/pool.js";
import { getDeliveryEstimate, getNearestServicePoints } from "../_integrations/shippingAdapter.js";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS, shippingCost } from "../_integrations/_lib/shippingRates.js";

const router = Router();

// Our warehouse – where the parcels are sent from
const FROM_POSTAL_CODE = process.env.SHOP_POSTAL_CODE ?? "";

// "211 19" and "21119" → "21119"
const postalCode = z
    .string()
    .trim()
    .regex(/^\d{3}\s?\d{2}$/, "Postnummer ska vara fem siffror, t.ex. 211 19")
    .transform((v) => v.replace(/\s/g, ""));

// Same price rule as checkout: discount is an amount in kr, rounded to öre
const unitPrice = (p) => Math.round((Number(p.price) - Number(p.discount ?? 0)) * 100) / 100;

/* --- GET /api/shipping/service-points?postalCode=21119&street=Storgatan 1&city=Malmö&limit=5 --- */
const ServicePointQuery = z.object({
    postalCode,
    street: z.string().trim().max(100).optional(),
    city: z.string().trim().max(60).optional(),
    limit: z.coerce.number().int().min(1).max(10).default(5),
});

router.get("/service-points", async (req, res) => {
    const parsed = ServicePointQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "Ogiltig adress", details: z.prettifyError(parsed.error) });
    }

    const { postalCode, street, city, limit } = parsed.data;

    // "Storgatan 12B" → streetName "Storgatan", streetNumber "12B"
    const match = street?.match(/^(.*?)\s+(\d+\s?[A-Za-z]?)$/);
    const streetName = match ? match[1] : street;
    const streetNumber = match ? match[2].replace(/\s/g, "") : undefined;

    try {
        const servicePoints = await getNearestServicePoints({ postalCode, streetName, streetNumber, city, limit });
        res.json({ data: servicePoints });
    } catch (err) {
        console.error("[SHIPPING] Service points failed:", err);
        res.status(502).json({ error: "Kunde inte hämta ombud just nu. Försök igen om en stund." });
    }
});

/* --- POST /api/shipping/quote  { postalCode, items: [{ id, quantity }] } → prices and delivery times --- */
// The cart total is calculated HERE from the database – the free-shipping limit can't be cheated from React.
const QuoteBody = z.object({
    postalCode,
    items: z
        .array(
            z.object({
                id: z.number().int().positive(),
                quantity: z.number().int().min(1).max(99),
            })
        )
        .min(1),
});

router.post("/quote", async (req, res, next) => {
    const parsed = QuoteBody.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Ogiltig förfrågan", details: z.prettifyError(parsed.error) });
    }

    const { postalCode, items } = parsed.data;

    // 1. The cart total from OUR prices
    let subtotal;
    try {
        const { rows: products } = await pool.query(
            "SELECT id, price, discount FROM product WHERE id = ANY($1::int[])",
            [items.map((i) => i.id)]
        );
        subtotal = items.reduce((sum, { id, quantity }) => {
            const p = products.find((p) => p.id === id);
            return p ? sum + unitPrice(p) * quantity : sum; // unknown products are stopped at checkout
        }, 0);
        subtotal = Math.round(subtotal * 100) / 100;
    } catch (err) {
        return next(err);
    }

    // 2. Delivery estimates for both options, in parallel.
    //    If PostNord doesn't answer, the customer can still choose – the estimate is just missing.
    const methods = Object.entries(SHIPPING_METHODS);
    const estimates = await Promise.allSettled(
        methods.map(([, option]) =>
            FROM_POSTAL_CODE
                ? getDeliveryEstimate({ fromPostalCode: FROM_POSTAL_CODE, toPostalCode: postalCode, service: option.service })
                : Promise.reject(new Error("SHOP_POSTAL_CODE is missing in .env"))
        )
    );

    const options = methods.map(([method, option], i) => {
        const estimate = estimates[i];
        if (estimate.status === "rejected") {
            console.warn(`[SHIPPING] No delivery estimate for ${method}:`, estimate.reason);
        }

        const price = shippingCost(method, subtotal);
        return {
            method,
            label: option.label,
            price,
            originalPrice: option.price,
            free: price === 0,
            estimate: estimate.status === "fulfilled" ? estimate.value : null,
        };
    });

    res.json({
        subtotal,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        remainingForFreeShipping: Math.max(0, Math.round((FREE_SHIPPING_THRESHOLD - subtotal) * 100) / 100),
        options,
        estimatesAvailable: estimates.some((e) => e.status === "fulfilled"),
    });
});

export default router;
