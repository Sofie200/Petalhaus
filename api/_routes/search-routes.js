import { Router } from 'express'
import { z } from 'zod';
import { searchProducts } from '../_integrations/searchAdapter.js'

const router = Router()

// Here we validate data from the USER before sending it on to another system.
const SearchQuery = z.object({
    q: z.string().max(100).default(''),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

// GET /api/search?q=ros&page=2
router.get('/', async (req, res) => {
    // 1. Validate the parameters
    const parsed = SearchQuery.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid search parameters', details: z.prettifyError(parsed.error) });
    }

    const { q, page, pageSize } = parsed.data;

    // 2. Search in Algolia
    try {
        res.json(await searchProducts(q, page, pageSize));
    } catch (err) {
        console.error('Algolia search failed:', err);
        res.status(502).json({ error: 'Search is unavailable right now. Try again later.' });
    }
});

export default router
