import { Router } from 'express'
import { z } from 'zod';
import { searchProducts } from '../_integrations/searchAdapter.js'

const router = Router()


// Here we validate data from the USER before sending it on to another system.
const SearchQuery = z.object({
  q: z.string().max(100).default(''),
  category: z.string().max(100).optional(), 
  inStock: z.stringbool().optional(), // 'true' -> true, 'false' -> false, anything else → 400
  page: z.coerce.number().int().min(1).default(1), // '2' => 2
  pageSize: z.coerce.number().int().min(1).max(50).default(10), // max '50' => 50
});


// GET /api/search?q=hoodie → search in Algolia
// Anyone may do this: it only READS, with the search key.
router.get('/', async (req, res) => {
  // const searchText = typeof req.query.q === 'string' ? req.query.q : ''
  // 1. Validate the parameters
  const result = SearchQuery.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: 'Invalid search parameters', details: z.prettifyError(result.error) });
    return;
  }

  // 2. The adapter searches and returns OUR model: a list of products
  res.json(await searchProducts(result.data.q));
})

export default router
