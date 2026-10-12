import { Router } from "express";
import { getRates } from '../integrations/currencyAdapter.js';

const router = Router()

router.get('/rates', async (req, res) => {
    const { fromCache, ...rates } = await getRates();

    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json(rates)
})

export default router