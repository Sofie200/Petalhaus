import { Router } from 'express'
import { indexProducts } from '../_integrations/searchAdapter.js'
import { getAllProducts } from '../_db/getAllProducts.js';

const router = Router();

/* --- INDEX ALL: POST /api/admin/search/index --- */
router.post('/search/index', async (_req, res, next) => {

    // 1. Fetch all products from the DB
    let products
    
    try {
        products = await getAllProducts()
    } catch (err) {
        return next(err)
    }

    // 2. Send them to Algolia
    try {
        const indexed = await indexProducts(products)
        res.json({ indexed })
    } catch (err) {
        console.error('Could not send the products to Algolia:', err)
        res.status(502).json({ error: 'Could not send the products to the search service. Try again later.' })
    }
});

export default router