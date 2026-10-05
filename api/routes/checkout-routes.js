import express from "express";
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/verifyToken.js";

const checkoutRouter = express.Router();

/* --- GET ORDER_ITEMS BY ORDER_ID --- */
checkoutRouter.get("/:id", verifyToken, async (req, res, next) => {
    try {
        const order_id = req.params.id;

        const result = await pool.query(
            `SELECT p.name, p.image, oi.price, oi.discount FROM order_item oi
            LEFT JOIN product p on p.id = oi.product_id 
            WHERE order_id = $1`,
            [order_id]
        );

        return res.json(result.rows);

    } catch (err) {
        next(err);
    }
});

/* --- CREATE ORDER --- */
checkoutRouter.post("/", verifyToken, async (req, res, next) => {
    const { user_id, grand_total } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO order_ (user_id, grand_total)
             VALUES ($1, $2)
             RETURNING *`,
            [user_id, grand_total]
        );

        res.status(201).json(result.rows);
    } catch (err) {
        next(err);
    }
});

/* --- CREATE ORDER_ITEM --- */
checkoutRouter.post("/item", verifyToken, async (req, res, next) => {
    const { order_id, product_id, price, discount } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO order_item (order_id, product_id, price, discount)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [order_id, product_id, price, discount]
        );

        res.status(201).json(result.rows);
    } catch (err) {
        next(err);
    }
});

export default checkoutRouter;