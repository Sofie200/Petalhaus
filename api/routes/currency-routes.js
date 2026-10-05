import { Router } from "express";
import { getRates } from '../integrations/currencyAdapter.js';

const router = Router()

router.get('/rates', async (req, res) => {
    const base = (req.query.base ?? 'SEK')

    res.json(await getRates(base))
})

export default router