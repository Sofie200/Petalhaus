import { pool } from "./pool.js";

export async function upsertProducts(products) {
    const skipped = [];

    // Dubbletter inom importen. Måste bort, annars kastar Postgres
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seen = new Set();
    const candidates = [];
    for (const p of products) {
        if (seen.has(p.ean)) {
            skipped.push({ ean: p.ean, reason: "Dubblett i importen" });
            continue;
        }
        seen.add(p.ean);
        candidates.push(p);
    }

    if (candidates.length === 0) return { inserted: [], updated: [], skipped };

    const { rows } = await pool.query(
        `INSERT INTO product (ean, name, category, price, updated)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[], $5::date[])
         ON CONFLICT (ean) DO UPDATE SET
             name     = EXCLUDED.name,
             category = EXCLUDED.category,
             price    = EXCLUDED.price,
             updated  = EXCLUDED.updated
         WHERE (product.name, product.category, product.price, product.updated)
               IS DISTINCT FROM
               (EXCLUDED.name, EXCLUDED.category, EXCLUDED.price, EXCLUDED.updated)
         RETURNING ean, (xmax = 0) AS inserted`,
        [
            candidates.map((p) => p.ean),
            candidates.map((p) => p.name),
            candidates.map((p) => p.category),
            candidates.map((p) => p.price),
            candidates.map((p) => p.updated),
        ]
    );

    const inserted = rows.filter((r) => r.inserted).map((r) => r.ean);
    const updated = rows.filter((r) => !r.inserted).map((r) => r.ean);

    // Det som inte kom tillbaka i RETURNING fanns redan och var identiskt
    const touched = new Set(rows.map((r) => r.ean));
    for (const p of candidates) {
        if (!touched.has(p.ean)) skipped.push({ ean: p.ean, reason: "Oförändrad" });
    }

    return { inserted, updated, skipped };
}