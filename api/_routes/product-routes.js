import express from "express";
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const productRouter = express.Router();

/* --- GET ALL PRODUCTS --- */
productRouter.get("/", async (req, res, next) => {
    try {
        const result = await pool.query("SELECT * FROM product");
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

/* --- SEARCH PRODUCTS --- */
productRouter.get("/search", async (req, res, next) => {
    const { search } = req.query;
    try {

        if (!search || search.trim() === "") {
            return res.status(400).json({ error: "Missing search query" });
        }

        const result = await pool.query("SELECT * FROM product WHERE name ILIKE $1",
            [`%${search}%`]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "No search match" });
        }

        res.json(result.rows);

    } catch (err) {
        next(err);
    }
});

/* --- GET PRODUCT BY ID --- */
productRouter.get("/:id", async (req, res, next) => {
    try {
        const result = await pool.query(
            "SELECT * FROM product WHERE id = $1",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

/* --- CREATE PRODUCT --- */
productRouter.post("/", verifyToken, requireAdmin, async (req, res, next) => {
    const { name, description, category_id, image, price, discount } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO product (name, description, category_id, image, price, discount)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, description, category_id, image, price, discount]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

/* --- UPDATE PRODUCT --- */
productRouter.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    const { name, description, category_id, image, price, discount } = req.body;

    try {
        const result = await pool.query(
            `UPDATE product
             SET name = $1, description = $2, category_id = $3,
                 image = $4, price = $5, discount = $6
             WHERE id = $7
             RETURNING *`,
            [name, description, category_id, image, price, discount, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

/* --- DELETE PRODUCT --- */
productRouter.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await pool.query(
            "DELETE FROM product WHERE id = $1 RETURNING *",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json({ message: "Product deleted", product: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

export default productRouter;