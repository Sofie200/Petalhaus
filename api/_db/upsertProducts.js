import { pool } from "./pool.js";
import { indexProducts } from "../_integrations/searchAdapter.js";

// Upsert on EAN: an existing product is updated, a new one is created.
// The supplier's article number (sku, e.g. LEV-1001) is NOT stored – it is only shown in the report.
export async function upsertProducts(products) {
    const skipped = [];

    // Dubbletter inom importen. Måste bort, annars kastar Postgres
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const seen = new Map(); // ean → första radnumret
    const candidates = [];
    for (const p of products) {
        if (seen.has(p.ean)) {
            skipped.push({
                row: p.row,
                sku: p.sku,
                ean: p.ean,
                reason: `Dubblett av rad ${seen.get(p.ean)}`,
            });
            continue;
        }
        seen.set(p.ean, p.row);
        candidates.push(p);
    }

    if (candidates.length === 0) {
        return { inserted: [], updated: [], unchanged: [], skipped, indexed: 0, indexError: null };
    }

    const { rows } = await pool.query(
        `INSERT INTO product (ean, name, category, price, stock, updated)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[], $5::int[], $6::date[])
         ON CONFLICT (ean) DO UPDATE SET
             name     = EXCLUDED.name,
             category = EXCLUDED.category,
             price    = EXCLUDED.price,
             stock    = EXCLUDED.stock,
             updated  = EXCLUDED.updated
         WHERE (product.name, product.category, product.price, product.stock, product.updated)
               IS DISTINCT FROM
               (EXCLUDED.name, EXCLUDED.category, EXCLUDED.price, EXCLUDED.stock, EXCLUDED.updated)
         RETURNING product.*, (xmax = 0) AS inserted`,
        [
            candidates.map((p) => p.ean),
            candidates.map((p) => p.name),
            candidates.map((p) => p.category),
            candidates.map((p) => p.price),
            candidates.map((p) => p.stock),
            candidates.map((p) => p.updated),
        ]
    );

    // The database only knows EAN – look up the article number from the import for the report
    const skuByEan = new Map(candidates.map((p) => [p.ean, p.sku]));
    const toReport = (ean) => ({ sku: skuByEan.get(ean) ?? null, ean });

    const inserted = rows.filter((r) => r.inserted).map((r) => toReport(r.ean));
    const updated = rows.filter((r) => !r.inserted).map((r) => toReport(r.ean));

    // Det som inte kom tillbaka i RETURNING fanns redan och var identiskt.
    // Egen lista, så att en andra import visar "oförändrade" och inte "överhoppade".
    const touched = new Set(rows.map((r) => r.ean));
    const unchanged = candidates
        .filter((p) => !touched.has(p.ean))
        .map((p) => toReport(p.ean));

    // Synka bara nya och ändrade produkter till Algolia.
    // Databasen är redan uppdaterad, så ett Algolia-fel ska inte fälla importen.
    let indexed = 0;
    let indexError = null;
    if (rows.length > 0) {
        try {
            indexed = await indexProducts(rows);
        } catch (err) {
            console.error("[IMPORT] Algolia sync failed:", err);
            indexError = "Produkterna sparades men kunde inte indexeras för sökningen.";
        }
    }

    return { inserted, updated, unchanged, skipped, indexed, indexError };
}