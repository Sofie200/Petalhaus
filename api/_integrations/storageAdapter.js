// TIMEOUT AND ERRORS – the common requirement in Labb 4:
// "Every call has a timeout. If the service is down, the user gets an understandable message, and the shop doesn't crash."
//   - Every request to Supabase gives up after 10 s (global.fetch in createClient below)
//   - supabase-js doesn't throw – it returns { data, error }. We check error and throw our own error
//   - The route catches it and answers 502 with a clear message (image-routes.js). The product keeps its old image.

import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? ''
const BUCKET = process.env.SUPABASE_BUCKET ?? 'product-images'
const TIMEOUT_MS = 10_000

if (!SUPABASE_URL || !SECRET_KEY) {
  throw new Error('Supabase is not configured. Copy .env.example to .env and fill in SUPABASE_URL and SUPABASE_SECRET_KEY.')
}

// Initiating supabase client – every request gets a timeout
const supabase = createClient(SUPABASE_URL, SECRET_KEY, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }),
  },
})

// The image types we accept, and the file extension each one gets in the bucket.
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
}

/**
 * @typedef {Object} ImageFile
 * @property {Buffer} buffer    the file's bytes
 * @property {string} mimeType  'image/png' or 'image/jpeg'
 */

/* --- 1. UPLOAD: an image → a file in the bucket → its public URL --- */

/**
 * @param {string} sku
 * @param {ImageFile} image
 * @returns {Promise<{ path: string, url: string }>}
 */
export async function uploadProductImage(sku, image) {
  // 1. A NEW, unique path every time – never the admin's own file name, and never overwrite.
  //    "hoodie.png" from two admins would overwrite each other. And Supabase's CDN can keep showing
  //    an old image for a while if a file is overwritten. A new path = a new URL = no stale image.
  const extension = EXTENSIONS[image.mimeType]
  if (!extension) {
    throw new Error(`Unsupported image type: ${image.mimeType}`)
  }
  const path = `products/${sku}/${randomUUID()}.${extension}`
  console.log('\n[UPLOAD] Saving in the bucket:', path)

  // 2. Send the bytes to Supabase Storage
  const { error } = await supabase.storage.from(BUCKET).upload(path, image.buffer, {
    contentType: image.mimeType,
    upsert: false,
  })

  if (error) {
    throw new Error(`Could not upload the image to Supabase: ${error.message}`)
  }

  // 3. The public URL. The bucket is PUBLIC: anyone with the URL can see the image – that's what we want
  //    for product images. getPublicUrl only builds the URL, it doesn't call Supabase.
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  console.log('[UPLOAD] Public URL:', data.publicUrl)

  // We return BOTH: the path to delete the file later, the URL to show it.
  return { path, url: data.publicUrl }
}

/* --- 2. REMOVE: delete a file we no longer use --- */

/**
 * @param {string} path  the path saved when the image was uploaded, e.g. "products/LEV-1001/….png"
 */
export async function removeProductImage(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) {
    throw new Error(`Could not delete the image in Supabase: ${error.message}`)
  }
  console.log('\n[REMOVE] Deleted from the bucket:', path)
}