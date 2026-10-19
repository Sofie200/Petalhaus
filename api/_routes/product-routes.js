import express from "express";
import { pool } from "../_db/pool.js";
import { indexProducts, removeProducts } from "../_integrations/searchAdapter.js";
import { verifyToken } from "../_middleware/verifyToken.js";
import { requireAdmin } from "../_middleware/requireAdmin.js";

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
    const { name, description, category, image, price, discount } = req.body;

    let product;
    try {
        const result = await pool.query(
            `INSERT INTO product (name, description, category, image, price, discount)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, description, category, image, price, discount]
        );
        product = result.rows[0];
    } catch (err) {
        return next(err);
    }

    let searchIndexed = true;
    try {
        await indexProducts([product]);
    } catch (err) {
        console.warn("Could not index product in Algolia:", err);
        searchIndexed = false;
    }

    res.status(201).json({ ...product, searchIndexed });
});

/* --- UPDATE PRODUCT --- */
productRouter.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    const { name, description, category, image, price, discount } = req.body;

    let product;
    try {
        const result = await pool.query(
            `UPDATE product
             SET name = $1, description = $2, category = $3,
                 image = $4, price = $5, discount = $6
             WHERE id = $7
             RETURNING *`,
            [name, description, category, image, price, discount, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        product = result.rows[0];
    } catch (err) {
        return next(err);
    }

    let searchIndexed = true;
    try {
        await indexProducts([product]); // upsert: samma objectID ersätter posten
    } catch (err) {
        console.warn("Could not update product in Algolia:", err);
        searchIndexed = false;
    }

    res.json({ ...product, searchIndexed });
});

/* --- DELETE PRODUCT --- */
productRouter.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    let product;
    try {
        const result = await pool.query(
            "DELETE FROM product WHERE id = $1 RETURNING *",
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        product = result.rows[0];
    } catch (err) {
        return next(err);
    }

    let searchIndexed = true;
    try {
        await removeProducts([product.id]);
    } catch (err) {
        console.warn("Could not remove product from Algolia:", err);
        searchIndexed = false;
    }

    res.json({ message: "Product deleted", product, searchIndexed });
});

export default productRouter;