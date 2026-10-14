import { algoliasearch } from 'algoliasearch'

const APP_ID = process.env.ALGOLIA_APP_ID ?? ''
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY ?? ''
const SEARCH_KEY = process.env.ALGOLIA_SEARCH_KEY ?? ''
const INDEX_NAME = process.env.ALGOLIA_INDEX ?? 'walkthrough_products'


/**
 *  --- 1. INDEX ---
 */

const adminClient = algoliasearch(APP_ID, ADMIN_KEY)
// How a product looks in Algolia: the same fields, but the id must be called objectID.
// { objectID, name, category, price, stock, description }

export async function indexProducts(products) {
  // 1. Our model → Algolia's model. sku becomes objectID.
  const records = []
  for (const product of products) {
    records.push({
      objectID: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      discount: product.discount,
      category: product.category,
      ean: product.ean,
      updated: product.updated,
    })
  }

  // 2. Send them to Algolia. Same objectID again → the product is updated, not duplicated (upsert).
  // waitForTasks: wait until Algolia is done, so a search right after finds the products.
  await adminClient.saveObjects({ indexName: INDEX_NAME, objects: records, waitForTasks: true })

  return records.length
}

// Removes products from Algolia, e.g. when they are deleted in the shop.
// Otherwise the search still finds products that no longer exist.
export async function removeProducts(skus) {
  // Our sku is Algolia's objectID, so we can send the skus as they are.

  // Code example beneath from the following docs: https://www.algolia.com/doc/guides/sending-and-managing-data/send-and-update-your-data/how-to/incremental-updates#delete-records
  // const response = await client.deleteObjects({
  //   indexName: 'INDEX_NAME',
  //   objectIDs: ['1', '2'],
  // });
}

/**
 *  --- 2. SEARCH ---
 */
// The search key may only SEARCH. If it leaks, nobody can change our products.
const searchClient = algoliasearch(APP_ID, SEARCH_KEY)

export async function searchProducts(searchText) {
  // We are only sending in the searchText through ?q=
  // But we can send in lots of params through querystring to make the searchresult much more functional with filters and pagination
  const params = {
    query: searchText,
    page: 5,
    pageSize: 2,
  }

  // 1. Ask Algolia. Typos are forgiven: "hodie" finds "Hoodie".
  const response = await searchClient.searchSingleIndex({
    indexName: INDEX_NAME,
    searchParams: {
      query: params.query,
      page: params.page - 1, // Algolia counts from 0, and we count from 1
      hitsPerPage: params.pageSize
    }
  })

  // 2. Algolia's model → our model. objectID becomes sku again.
  const products = []
  for (const hit of response.hits) {
    products.push({
      sku: hit.objectID,
      name: hit.name,
      category: hit.category,
      price: hit.price,
      stock: hit.stock,
      description: hit.description
    })
  }

  const total = response.nbHits ?? 0
  return {
    data: products,
    meta: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.ceil(total / params.pageSize) }
  }
}