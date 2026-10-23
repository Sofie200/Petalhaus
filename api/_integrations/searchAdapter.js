import { algoliasearch } from 'algoliasearch'

const APP_ID = process.env.ALGOLIA_APP_ID ?? ''
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY ?? ''
const SEARCH_KEY = process.env.ALGOLIA_SEARCH_KEY ?? ''
const INDEX_NAME = process.env.ALGOLIA_INDEX ?? 'petalhaus_products'


/* --- 1. INDEX --- */

const adminClient = algoliasearch(APP_ID, ADMIN_KEY)
// How a product looks in Algolia: the same fields, but the id must be called objectID.
// { objectID, name, description, price, discount, category, image, ean, updated }

// Our model → Algolia's model. id becomes objectID.
// Used by both indexProducts and replaceAllProducts, so the records always look the same.
function toSearchRecord(product) {
    return {
        objectID: String(product.id),
        name: product.name,
        description: product.description,
        price: Number(product.price),
        discount: product.discount === null ? null : Number(product.discount),
        category: product.category,
        image: product.image,
        ean: product.ean,
        updated: product.updated,
    }
}

export async function indexProducts(products) {
    const records = products.map(toSearchRecord)

    // Same objectID again → the product is updated, not duplicated (upsert).
    // waitForTasks: wait until Algolia is done, so a search right after finds the products.
    await adminClient.saveObjects({ indexName: INDEX_NAME, objects: records, waitForTasks: true })

    return records.length
}

// Reindex the entire DB: Algolia builds a temporary index with exactly these records and then swaps it in.
// Records that are NOT in the list (e.g. products deleted directly in the DB) disappear.
// The index settings (searchable attributes, ranking, synonyms) are copied over.
export async function replaceAllProducts(products) {
    const records = products.map(toSearchRecord)

    await adminClient.replaceAllObjects({ indexName: INDEX_NAME, objects: records })

    return records.length
}

// Removes products from Algolia, e.g. when they are deleted in the shop.
// Otherwise the search still finds products that no longer exist.
export async function removeProducts(ids) {
    // Our id is Algolia's objectID, so we can send the ids as they are.
    // Code example beneath from the following docs: https://www.algolia.com/doc/guides/sending-and-managing-data/send-and-update-your-data/how-to/incremental-updates#delete-records

    await adminClient.deleteObjects({
        indexName: INDEX_NAME,
        objectIDs: ids.map(String),
        waitForTasks: true,
    })
}

/* --- 2. SEARCH --- */

// The search key may only SEARCH. If it leaks, nobody can change our products.
const searchClient = algoliasearch(APP_ID, SEARCH_KEY)

export async function searchProducts(searchText, page = 1, pageSize = 20) {
    // 1. Ask Algolia. Typos are forgiven.
    const response = await searchClient.searchSingleIndex({
        indexName: INDEX_NAME,
        searchParams: {
            query: searchText,
            page: page - 1, // Algolia counts from 0, we count from 1
            hitsPerPage: pageSize,
        },
    })

    // 2. Algolia's model → our model. objectID becomes id again.
    const products = response.hits.map((hit) => ({
        id: Number(hit.objectID),
        name: hit.name,
        description: hit.description,
        price: hit.price,
        discount: hit.discount,
        category: hit.category,
        image: hit.image,
    }))

    const total = response.nbHits ?? 0
    return {
        data: products,
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
}