import express from "express";
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/verifyToken.js";

const cartRouter = express.Router();

/* --- GET CART_ITEMS BY USER_ID --- */
cartRouter.get("/:id", verifyToken, async (req, res, next) => {
    try {
        const user_id = req.params.id;

        const result = await pool.query(
            `SELECT * FROM cart_item c
            LEFT JOIN product p on p.id = c.product_id 
            WHERE c.user_id = $1`,
            [user_id]
        );

        return res.json(result.rows);

    } catch (err) {
        next(err);
    }
});


/* --- CREATE CART_ITEM --- */

cartRouter.post("/", verifyToken, async (req, res, next) => {
    const { user_id, product_id, quantity } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO cart_item (user_id, product_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, product_id)
             DO UPDATE SET quantity = cart_item.quantity + EXCLUDED.quantity
             RETURNING *`,
            [user_id, product_id, quantity]
        );

        res.status(201).json(result.rows[0]);

    } catch (err) {
        next(err);
    }
});


/* --- UPDATE CART_ITEM --- */
cartRouter.put("/", verifyToken, async (req, res, next) => {
    const { user_id, product_id, quantity } = req.body;

    try {
        const result = await pool.query(
            `UPDATE cart_item SET quantity = $3
             WHERE user_id = $1 AND product_id = $2
             RETURNING *;`,
            [user_id, product_id, quantity]
        );

        res.status(201).json(result.rows);
    } catch (err) {
        next(err);
    }
});


/* --- DELETE CART_ITEM --- */
cartRouter.delete("/", verifyToken, async (req, res, next) => {
    const { user_id, product_id } = req.body;

    try {
        const result = await pool.query(
            "DELETE FROM cart_item WHERE user_id = $1 AND product_id = $2 RETURNING *",
            [user_id, product_id]   // ✔ RÄTT
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Cart item not found" });
        }

        res.json({ message: "Cart item deleted", item: result.rows[0] });

    } catch (err) {
        next(err);
    }
});

/* --- CLEAR CART --- */
cartRouter.delete("/clear/:id", verifyToken, async (req, res, next) => {
    try {
        const user_id = req.params.id;

        await pool.query(
            "DELETE FROM cart_item WHERE user_id = $1",
            [user_id]
        );

        res.json({ message: "Cart cleared" });

    } catch (err) {
        next(err);
    }
});

export default cartRouter;