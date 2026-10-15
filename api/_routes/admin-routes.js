import { Router } from 'express'
import { indexProducts } from '../_integrations/searchAdapter.js'
import { getAllProducts } from '../_db/getAllProducts.js';
import { verifyToken } from "../middleware/verifyToken.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router()

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
})


/* --- CREATE: POST /api/admin/products --- */

router.post('/products', async (req, res) => {
  const newProduct = {
    sku: 'LEV-1009',
    name: 'Vit strumpor',
    category: 'Strumpor',
    price: 29,
    stock: 33,
    description: 'Mjuk strumpor i ekologisk bomull.'
  }

  try {
    // Remember that Algolia is to mirror what is saved in the products table in your DB. Make sure to do the following order when performing CRUD
    // 1. Save first in DB
    // 2. If all is well, index the new product in Algolia.
    await indexProducts([newProduct])
    res.status(201).json({ newProduct, searchIndexed: true })
  } catch (err) {
    console.warn('Could not index the new product to Algolia:', err)
    res.status(201).json({ newProduct, searchIndexed: false })
  }
})

/* --- UPDATE: PUT /api/admin/products/:sku --- 
router.put('/products/:sku', async (req, res) => {
  const updatedProduct = {
    sku: req.params.sku, // e.g. LEV-1009, the product we created above
    name: 'Vita strumpor - updated',
    category: 'Strumpor',
    price: 39, // new price
    stock: 20, // new stock
    description: 'Mjuka strumpor i ekologisk bomull.'
  }

  // Same order as for create:
  // 1. Update first in DB
  // 2. If all is well, update the product in Algolia.
  // It's the SAME call as for create: saveObjects is an upsert on objectID,
  // so the same sku replaces the old record instead of creating a new one.

  try {
    await indexProducts([updatedProduct])
    res.json({ updatedProduct, searchIndexed: true })
  } catch (err) {
    console.warn('Could not index the updated product to Algolia:', err)
    res.json({ updatedProduct, searchIndexed: false })
  }
})

/* --- DELETE: DELETE /api/admin/products/:sku --- 
router.delete('/products/:sku', async (req, res) => {
  const deletedSku = req.params.sku // e.g. LEV-1009

  // Same order as for create and update:
  // 1. Delete first in DB
  // 2. If all is well, remove the product from Algolia.
  // Otherwise the search still finds a product that no longer exists.
})

// Think about: what else changes a product? An order that lowers the stock?
// Then it also has to update Algolia – otherwise the search shows the wrong stock.
*/
export default router