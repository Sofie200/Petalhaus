import { Router } from "express";
import { getCsvProducts, getXmlProducts } from "../_integrations/importAdapter.js";
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
    importRouter.get(`/${format}`, async (req, res, next) => {
        try {
            const result = await getProducts();
            res.json(req.query.debug ? result : result.products);
        } catch (err) {
            next(err);
        }
    });

    // Importera: hämta, validera och spara i databasen
    importRouter.post(`/${format}`, async (req, res, next) => {
        try {
            const { products, skippedCount } = await getProducts();
            const saved = await upsertProducts(products);
            res.json({ format, saved, skippedCount });
        } catch (err) {
            next(err);
        }
    });
}

export default importRouter;