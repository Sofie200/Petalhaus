import express from "express";
import { pool } from "../_db/pool.js";
import { indexProducts, removeProducts, replaceAllProducts } from "../_integrations/searchAdapter.js";
import { verifyToken } from "../_middleware/verifyToken.js";
import { requireAdmin } from "../_middleware/requireAdmin.js";

const productRouter = express.Router();

// "12" → 12, "abc" / "12abc" / "-1" → null. Otherwise Postgres throws on WHERE id = 'abc' → 500.
function parseId(value) {
    return /^\d+$/.test(value) ? Number(value) : null;
}

// Sync to Algolia AFTER the database. Upsert: only THESE products are added or updated.
// If Algolia fails, the database change still stands – the answer says so with searchIndexed: false.
async function syncIndex(products) {
    try {
        await indexProducts(products);
        return true;
    } catch (err) {
        console.warn("Could not index product(s) in Algolia:", err);
        return false;
    }
}

/* --- GET ALL PRODUCTS --- */
productRouter.get("/", async (req, res, next) => {
    try {
        const result = await pool.query("SELECT * FROM product ORDER BY id");
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});


/* --- REINDEX ALL (admin) --- */
// Safety net for changes made directly in the database, which Algolia never hears about.
// Registered before "/:id" for readability (POST doesn't clash with GET/PUT/DELETE "/:id" anyway).
productRouter.post("/reindex", verifyToken, requireAdmin, async (req, res, next) => {
    let products;
    try {
        const result = await pool.query("SELECT * FROM product ORDER BY id");
        products = result.rows;
    } catch (err) {
        return next(err);
    }

    // Replaces the WHOLE index with exactly the products in the database –
    // so products deleted directly in the DB disappear from the search too.
    let searchIndexed = true;
    try {
        await replaceAllProducts(products);
    } catch (err) {
        console.warn("Could not replace the Algolia index:", err);
        searchIndexed = false;
    }

    res.json({ message: "Alla produkter är indexerade", count: products.length });

    return searchIndexed;
});

/* --- GET PRODUCT BY ID --- */
productRouter.get("/:id", async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid product id" });

    try {
        const result = await pool.query("SELECT * FROM product WHERE id = $1", [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

/* --- CREATE PRODUCT (admin) --- */
productRouter.post("/", verifyToken, requireAdmin, async (req, res, next) => {
    const { name, description, category, image, price, discount, stock } = req.body;

    let product;
    try {
        const result = await pool.query(
            `INSERT INTO product (name, description, category, image, price, discount, stock)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [name, description, category, image, price, discount, stock ?? 0]
        );
        product = result.rows[0];
    } catch (err) {
        return next(err);
    }

    const searchIndexed = await syncIndex([product]);
    res.status(201).json({ ...product, searchIndexed });
});

/* --- UPDATE PRODUCT (admin) --- */
productRouter.put("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid product id" });

    const { name, description, category, image, price, discount, stock } = req.body;

    let product;
    try {
        // COALESCE: if the admin form doesn't send stock, keep the current value instead of setting it to NULL
        const result = await pool.query(
            `UPDATE product
             SET name = $1, description = $2, category = $3,
                 image = $4, price = $5, discount = $6,
                 stock = COALESCE($7, stock)
             WHERE id = $8
             RETURNING *`,
            [name, description, category, image, price, discount, stock ?? null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Product not found" });
        }
        product = result.rows[0];
    } catch (err) {
        return next(err);
    }

    const searchIndexed = await syncIndex([product]); // upsert: same objectID replaces the record
    res.json({ ...product, searchIndexed });
});

/* --- DELETE PRODUCT (admin) --- */
productRouter.delete("/:id", verifyToken, requireAdmin, async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: "Invalid product id" });

    let product;
    try {
        const result = await pool.query(
            "DELETE FROM product WHERE id = $1 RETURNING *",
            [id]
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