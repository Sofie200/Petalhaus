import { Router } from 'express'
import multer from 'multer'
import { pool } from '../_db/pool.js'
import { removeProductImage, uploadProductImage } from '../_integrations/storageAdapter.js'
import { indexProducts } from '../_integrations/searchAdapter.js'
import { verifyToken } from '../_middleware/verifyToken.js'
import { requireAdmin } from '../_middleware/requireAdmin.js'

const router = Router()

const MAX_SIZE = 4 * 1024 * 1024 // 4 MB, matches the Supabase Storage bucket limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png'] // a .jpg file is sent as image/jpeg

// multer reads multipart/form-data, the format a browser uses to send files.
// The file is kept in memory (req.file.buffer) – we send it on to Supabase, never save it on our server.
const upload = multer({
	limits: { fileSize: MAX_SIZE },
})

// "12" → 12, anything else → null. Otherwise Postgres throws on WHERE id = 'abc' → 500.
function parseId(value) {
	return /^\d+$/.test(value) ? Number(value) : null
}

// Receives ONE file in the field "image". If multer can't read it, we answer 400 with a clear message.
function receiveImage(req, res, next) {
	upload.single('image')(req, res, function (err) {
		if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
			res.status(400).json({ error: `Bilden är för stor. Max ${MAX_SIZE / (1024 * 1024)} MB.` })
			return
		}
		if (err) {
			res.status(400).json({ error: 'Kunde inte läsa filen. Skicka EN bildfil i fältet "image".' })
			return
		}
		next()
	})
}

// Sync to Algolia after the database – the image URL is part of the search index
async function syncIndex(product) {
	try {
		await indexProducts([product])
		return true
	} catch (err) {
		console.warn('[IMAGE] Could not update the search index:', err)
		return false
	}
}

// Only admins may upload and delete images
router.use(verifyToken, requireAdmin)

/* --- UPLOAD: POST /upload/:id  (multipart/form-data, field "image") → { url, path, searchIndexed } --- */
router.post('/upload/:id', receiveImage, async (req, res, next) => {
	// 1. Validate id and file
	const id = parseId(req.params.id)
	if (id === null) {
		res.status(400).json({ error: 'Ogiltigt produkt-id' })
		return
	}

	if (!req.file) {
		res.status(400).json({ error: 'Bild saknas. Skicka bildfilen i fältet "image".' })
		return
	}

	if (!ALLOWED_TYPES.includes(req.file.mimetype)) {
		res.status(400).json({ error: 'Filen måste vara en JPG- eller PNG-bild.' })
		return
	}

	console.log('\n[IMAGE] Upload for product', id, '–', req.file.originalname, req.file.mimetype, req.file.size, 'bytes')

	// 2. The product must exist, and we need its OLD image path to delete it afterwards
	let oldImagePath
	try {
		const { rows: [product] } = await pool.query('SELECT id, image FROM product WHERE id = $1', [id])
		if (!product) {
			res.status(404).json({ error: 'Produkten finns inte' })
			return
		}
		oldImagePath = product.image
	} catch (err) {
		return next(err)
	}

	// 3. Upload to Supabase Storage
	let image
	try {
		image = await uploadProductImage(id, { buffer: req.file.buffer, mimeType: req.file.mimetype })
	} catch (err) {
		console.error('[IMAGE] Upload failed:', err)
		// The product keeps its old image – nothing has been changed in the DB yet.
		res.status(502).json({ error: 'Bildtjänsten svarar inte just nu. Försök igen om en stund.' })
		return
	}

	// 4. Save BOTH on the product: the URL to show the image, the path to delete the file later
	let product
	try {
		const { rows } = await pool.query(
			'UPDATE product SET image = $1, image_path = $2 WHERE id = $3 RETURNING *',
			[image.url, image.path, id]
		)
		product = rows[0]
	} catch (err) {
		// The DB didn't save it – remove the new file, so it isn't left in the bucket without a product
		await removeProductImage(image.path).catch((e) => console.warn('[IMAGE] Cleanup failed:', e))
		return next(err)
	}

	// 5. Delete the OLD image – only now, after the new one is uploaded AND saved.
	//    If it fails: log it and still answer 201. The product shows the new image,
	//    the old file is only left over in the bucket.
	if (oldImagePath) {
		try {
			await removeProductImage(oldImagePath)
		} catch (err) {
			console.warn('[IMAGE] Could not delete the old image:', oldImagePath, err)
		}
	}

	// 6. The search index shows the image too
	const searchIndexed = await syncIndex(product)

	res.status(201).json({ url: image.url, path: image.path, searchIndexed })
})

/* --- DELETE: DELETE /delete/:id → { deleted, searchIndexed } --- */
// Removes the product's image without replacing it.
router.delete('/delete/:id', async (req, res, next) => {
	const id = parseId(req.params.id)
	if (id === null) {
		res.status(400).json({ error: 'Ogiltigt produkt-id' })
		return
	}

	// 1. The image's path comes from the DB – NEVER from the request,
	//    so an admin can't delete any file in the bucket by sending another path.
	let current
	try {
		const { rows } = await pool.query('SELECT id, image, image FROM product WHERE id = $1', [id])
		current = rows[0]
	} catch (err) {
		return next(err)
	}

	if (!current) {
		res.status(404).json({ error: 'Produkten finns inte' })
		return
	}
	if (!current.image && !current.image) {
		res.status(404).json({ error: 'Produkten har ingen bild' })
		return
	}

	// 2. Delete the file from Supabase Storage.
	//    An image without image is an external URL (e.g. from the import) – there is no file to delete.
	if (current.image) {
		try {
			await removeProductImage(current.image)
		} catch (err) {
			console.error('[IMAGE] Delete failed:', err)
			// The product keeps its image – nothing has been changed in the DB.
			res.status(502).json({ error: 'Bildtjänsten svarar inte just nu. Försök igen om en stund.' })
			return
		}
	}

	// 3. Remove the image from the product as well
	let product
	try {
		const { rows } = await pool.query(
			'UPDATE product SET image = NULL, image = NULL WHERE id = $1 RETURNING *',
			[id]
		)
		product = rows[0]
	} catch (err) {
		return next(err)
	}

	const searchIndexed = await syncIndex(product)

	res.json({ deleted: current.image ?? current.image, searchIndexed })
})

export default router