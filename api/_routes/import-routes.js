import { Router } from "express";
import { getCsvProducts, getXmlProducts } from "../_integrations/supplierAdapter.js";
import { upsertProducts } from "../_db/upsertProducts.js";
import { verifyToken } from "../_middleware/verifyToken.js";
import { requireAdmin } from "../_middleware/requireAdmin.js";

const importRouter = Router();

const SOURCES = {
    csv: getCsvProducts,
    xml: getXmlProducts,
};

for (const [format, getProducts] of Object.entries(SOURCES)) {
    // Förhandsgranska: hämta och validera, men spara ingenting
    importRouter.get(`/${format}`, verifyToken, requireAdmin, async (req, res, next) => {
        try {
            const result = await getProducts();
            res.json(req.query.debug ? result : result.products);
        } catch (err) {
            next(err);
        }
    });

    // Importera: hämta, validera och spara i databasen
    // Importera: hämta, validera och spara i databasen
    importRouter.post(`/${format}`, verifyToken, requireAdmin, async (req, res, next) => {
        // 1. Hämta från leverantören – ett fel här är leverantörens, inte vårt
        let products, invalid;
        try {
            ({ products, skipped: invalid } = await getProducts());
        } catch (err) {
            console.error(`[IMPORT] Could not fetch ${format} from supplier:`, err);
            return res.status(502).json({
                error: "Leverantören svarar inte just nu. Försök igen om en stund.",
            });
        }

        // 2. Spara i databasen (och synka till Algolia)
        try {
            const { inserted, updated, unchanged, skipped, indexed, indexError } =
                await upsertProducts(products);
            const allSkipped = [...invalid, ...skipped];

            res.json({
                format,
                counts: {
                    inserted: inserted.length,
                    updated: updated.length,
                    unchanged: unchanged.length,
                    skipped: allSkipped.length,
                },
                inserted,
                updated,
                unchanged,
                skipped: allSkipped,
                indexed,
                indexError,
            });
        } catch (err) {
            next(err);
        }
    });
}

export default importRouter;