import { Router } from 'express'
import { getCsvProducts, getXmlProducts } from '../_integrations/supplierAdapter.js'
import { pool } from "../db/pool.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

/* --- GET CSV --- */

const importRouter = Router()

importRouter.get('/csv', async (req, res) => {
    const result = await getCsvProducts()
    res.json(req.query.debug ? result : result.products)
})

importRouter.get('/xml', async (req, res) => {
    const result = await getXmlProducts()
    res.json(req.query.debug ? result : result.products)
})

export default importRouter;