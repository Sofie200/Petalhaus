import { pool } from "./pool.js";

export async function upsertProducts(products) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        for (const p of products) {
            await client.query(
                `INSERT INTO product (ean, name, category, price, updated)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (ean) DO UPDATE SET
           name     = EXCLUDED.name,
           category = EXCLUDED.category,
           price    = EXCLUDED.price,
           updated  = EXCLUDED.updated`,
                [p.ean, p.name, p.category, p.price, p.updated],
            );
        }

        await client.query("COMMIT");
        return products.length;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}