import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../_db/pool.js'
import { verifyToken } from '../_middleware/verifyToken.js'
import { createEmbeddedCheckout } from '../_integrations/paymentAdapter.js'

const router = Router()

// React sends: { items: [{ id, quantity }] } – never prices
const Cart = z.object({
	items: z
		.array(
			z.object({
				id: z.number().int().positive(),
				quantity: z.number().int().min(1).max(99),
			})
		)
		.min(1),
})

class CartError extends Error { }

const unitPrice = (p) =>
	Math.round((Number(p.price) - Number(p.discount ?? 0)) * 100) / 100

// The cart → a pending order with OUR prices, in one transaction
async function createOrder(userId, cart) {
	const client = await pool.connect()
	try {
		await client.query('BEGIN')

		const { rows: products } = await client.query(
			'SELECT id, name, price, discount, stock FROM product WHERE id = ANY($1::int[])',
			[cart.items.map((i) => i.id)]
		)

		// Merge duplicate rows, so the stock check sees the total quantity per product
		const quantities = new Map()
		for (const { id, quantity } of cart.items) {
			quantities.set(id, (quantities.get(id) ?? 0) + quantity)
		}

		const items = [...quantities].map(([id, quantity]) => {
			const p = products.find((p) => p.id === id)
			if (!p) throw new CartError(`Produkten ${id} finns inte`)
			if (p.stock < quantity) throw new CartError(`${p.name} finns inte i lager`)
			return { product: p, name: p.name, price: unitPrice(p), quantity }
		})

		const grandTotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

		const { rows: [order] } = await client.query(
			`INSERT INTO order_ (user_id, grand_total, stripe_status)
       VALUES ($1, $2, 'pending') RETURNING id`,
			[userId, grandTotal]
		)

		// One row per unit, one query per product
		for (const i of items) {
			await client.query(
				`INSERT INTO order_item (order_id, product_id, price, discount)
         SELECT $1, $2, $3, $4 FROM generate_series(1, $5)`,
				[order.id, i.product.id, i.product.price, i.product.discount, i.quantity]
			)
		}

		await client.query('COMMIT')

		return {
			orderId: order.id,
			items: items.map(({ name, price, quantity }) => ({ name, price, quantity })),
		}
	} catch (err) {
		await client.query('ROLLBACK')
		throw err
	} finally {
		client.release()
	}
}

/* --- POST /api/checkout/embedded  { items: [{ id, quantity }] } → { clientSecret } --- */
router.post('/embedded', verifyToken, async (req, res) => {
	const cart = Cart.safeParse(req.body)
	if (!cart.success) {
		res.status(400).json({ error: 'Invalid cart', details: z.prettifyError(cart.error) })
		return
	}

	let order
	try {
		order = await createOrder(req.user.user_id, cart.data)
	} catch (err) {
		if (err instanceof CartError) {
			res.status(400).json({ error: err.message })
			return
		}
		console.error('Could not create order:', err)
		res.status(500).json({ error: 'Kunde inte skapa ordern' })
		return
	}

	try {

		const { rows: [user] } = await pool.query(
			'SELECT email FROM user_ WHERE id = $1',
			[req.user.user_id]
		)

		const checkout = await createEmbeddedCheckout(order.orderId, order.items, {
			userId: req.user.user_id,
			email: user?.email,
		})

		await pool.query(
			'UPDATE order_ SET stripe_session_id = $1 WHERE id = $2',
			[checkout.sessionId, order.orderId]
		)

		res.json({ clientSecret: checkout.clientSecret })
	} catch (err) {
		console.error('Could not create the Stripe Checkout Session:', err)
		// No session = can never be paid, so don't leave it hanging as pending
		await pool.query(
			"UPDATE order_ SET stripe_status = 'cancelled' WHERE id = $1 AND stripe_status = 'pending'",
			[order.orderId]
		)
		res.status(502).json({ error: 'Betaltjänsten svarar inte. Försök igen senare.' })
	}
})

/* --- GET /api/checkout/status?session_id=... → { orderId, status } --- */
// For the return page. Status comes from OUR db, set by the webhook.
/* --- GET /api/checkout/status?session_id=... → the order for the return page --- */
router.get('/status', verifyToken, async (req, res) => {
	const { rows: [order] } = await pool.query(
		`SELECT o.id, o.stripe_status, o.grand_total, u.email
		 FROM order_ o
		 JOIN user_ u ON u.id = o.user_id
		 WHERE o.stripe_session_id = $1 AND o.user_id = $2`,
		[req.query.session_id, req.user.user_id]
	)
	if (!order) {
		res.status(404).json({ error: 'Ordern hittades inte' })
		return
	}

	// One row per unit in order_items → group them back into products with a quantity
	const { rows: items } = await pool.query(
		`SELECT p.name, oi.price, oi.discount, COUNT(*)::int AS quantity
		 FROM order_item oi
		 JOIN product p ON p.id = oi.product_id
		 WHERE oi.order_id = $1
		 GROUP BY p.name, oi.price, oi.discount`,
		[order.id]
	)

	res.json({
		orderId: order.id,
		status: order.stripe_status,
		total: Number(order.grand_total),
		email: order.email,
		items,
	})
})

export default router