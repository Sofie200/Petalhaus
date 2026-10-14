import { Router } from "express";
import { getCsvProducts, getXmlProducts } from "../_integrations/supplierAdapter.js";
import { upsertProducts } from "../_db/upsertProducts.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

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
    importRouter.post(`/${format}`, verifyToken, requireAdmin, async (req, res, next) => {
        try {
            const { products, skipped: invalid } = await getProducts();
            const { inserted, updated, skipped } = await upsertProducts(products);
            const allSkipped = [...invalid, ...skipped];

            res.json({
                format,
                counts: { inserted: inserted.length, updated: updated.length, skipped: allSkipped.length },
                inserted,
                updated,
                skipped: allSkipped,
            });
        } catch (err) {
            next(err);
        }
    });
}

export default importRouter;