import express from "express";
import { SHIPPING_METHODS } from "../_integrations/_lib/shippingRates.js";
import { pool } from "../_db/pool.js";
import { verifyToken } from "../_middleware/verifyToken.js";
import { requireAdmin } from "../_middleware/requireAdmin.js";

const orderRouter = express.Router();

/* --- GET ORDERS --- */
orderRouter.get("/", verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.date, o.status, o.grand_total, u.first_name, u.last_name, u.email FROM order_ o
            LEFT JOIN user_ u on u.id = o.user_id
            WHERE stripe_status not in ('pending','cancelled')
            ORDER BY o.id desc`
        );

        return res.json(result.rows);

    } catch (err) {
        next(err);
    }
});

/* --- GET ORDER_ITEMS --- */
orderRouter.get("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    // "12" → 12, anything else → 400. Otherwise Postgres throws on WHERE id = 'abc' → 500.
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
    if (id === null) return res.status(400).json({ error: "Ogiltigt order-id" });

    try {
        const { rows: [order] } = await pool.query(
            `SELECT shipping_method, shipping_cost, service_point_name
             FROM order_ WHERE id = $1`,
            [id]
        );
        if (!order) return res.status(404).json({ error: "Ordern hittades inte" });

        const { rows: items } = await pool.query(
            `SELECT oi.product_id, oi.price, oi.discount, p.name
             FROM order_item oi
             LEFT JOIN product p ON p.id = oi.product_id
             WHERE oi.order_id = $1`,
            [id]
        );

        // Shipping as one extra row, shaped like an order_item
        if (order.shipping_method) {
            const label = SHIPPING_METHODS[order.shipping_method]?.label ?? order.shipping_method;
            items.push({
                product_id: null,
                name: order.service_point_name
                    ? `Frakt – ${label} (${order.service_point_name})`
                    : `Frakt – ${label}`,
                price: order.shipping_cost ?? "0",
                discount: null,
                type: "shipping",
            });
        }

        return res.json(items);
    } catch (err) {
        next(err);
    }
});

/* --- UPDATE ORDER STATUS --- */
orderRouter.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    const { status } = req.body;
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            `UPDATE order_
             SET status = $2
             WHERE id = $1
             RETURNING *`,
            [id, status]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

export default orderRouter;