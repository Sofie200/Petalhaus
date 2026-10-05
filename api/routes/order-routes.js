import express from "express";
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const orderRouter = express.Router();

/* --- GET ORDERS --- */
orderRouter.get("/", verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT o.id, o.date, o.status, u.first_name, u.last_name, u.email FROM order_ o
            LEFT JOIN user_ u on u.id = o.user_id
            ORDER BY o.id desc`
        );

        return res.json(result.rows);

    } catch (err) {
        next(err);
    }
});

/* --- GET ORDER_ITEMS --- */
orderRouter.get("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            `SELECT oi.product_id, oi.price, oi.discount, p.name FROM order_item oi
            LEFT JOIN product p on p.id = oi.product_id
            WHERE oi.order_id=$1`,
            [id]
        );

        return res.json(result.rows);

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