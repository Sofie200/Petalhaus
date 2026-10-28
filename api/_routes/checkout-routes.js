import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../_db/pool.js'
import { verifyToken } from '../_middleware/verifyToken.js'
import { createEmbeddedCheckout } from '../_integrations/paymentAdapter.js'
import { SHIPPING_METHODS, shippingCost } from '../_integrations/_lib/shippingRates.js'
import { getNearestServicePoints } from '../_integrations/shippingAdapter.js'

const router = Router()

// React sends WHAT to buy and HOW to deliver it – never prices, never the shipping cost.
//   {
//     "items": [{ "id": 12, "quantity": 2 }],
//     "shipping": { "method": "service_point", "postalCode": "21119", "servicePointId": "123456", "servicePointName": "ICA Nära Möllan" }
//   }
const Shipping = z
	.object({
		method: z.enum(Object.keys(SHIPPING_METHODS)), // "service_point" | "home"
		postalCode: z
			.string()
			.trim()
			.regex(/^\d{3}\s?\d{2}$/, 'Postnummer ska vara fem siffror')
			.transform((v) => v.replace(/\s/g, '')),
		servicePointId: z.string().trim().max(20).optional(),
		servicePointName: z.string().trim().max(100).optional(),
	})
	// Ombud needs a chosen service point – home delivery doesn't
	.refine((s) => s.method !== 'service_point' || !!s.servicePointId, {
		message: 'Välj ett ombud',
		path: ['servicePointId'],
	})

const Cart = z.object({
	items: z
		.array(
			z.object({
				id: z.number().int().positive(),
				quantity: z.number().int().min(1).max(99),
			})
		)
		.min(1),
	shipping: Shipping,
})

class CartError extends Error { }

const round = (n) => Math.round(n * 100) / 100

const unitPrice = (p) => round(Number(p.price) - Number(p.discount ?? 0))


// The cart → a pending order with OUR prices and OUR shipping cost, in one transaction
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

		// Shipping is calculated HERE, from the server's subtotal – the free-shipping limit can't be cheated
		const subtotal = round(items.reduce((sum, i) => sum + i.price * i.quantity, 0))
		const { method, postalCode, servicePointId, servicePointName } = cart.shipping
		const shipping = shippingCost(method, subtotal)
		const grandTotal = round(subtotal + shipping)

		const { rows: [order] } = await client.query(
			`INSERT INTO order_ (
				user_id, grand_total, stripe_status,
				shipping_method, shipping_cost, shipping_postal_code, service_point_id, service_point_name
			 )
			 VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)
			 RETURNING id`,
			[
				userId, grandTotal,
				method, shipping, postalCode,
				method === 'service_point' ? servicePointId : null,
				method === 'service_point' ? servicePointName ?? null : null,
			]
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

		// What Stripe charges: the products, plus shipping as its own line (only when it costs something)
		const lineItems = items.map(({ name, price, quantity }) => ({ name, price, quantity }))
		if (shipping > 0) {
			lineItems.push({ name: `Frakt – ${SHIPPING_METHODS[method].label}`, price: shipping, quantity: 1 })
		}

		return { orderId: order.id, items: lineItems }
	} catch (err) {
		await client.query('ROLLBACK')
		throw err
	} finally {
		client.release()
	}
}

/* --- POST /api/checkout/embedded  { items, shipping } → { clientSecret } --- */
router.post('/embedded', verifyToken, async (req, res) => {
	const cart = Cart.safeParse(req.body)
	if (!cart.success) {
		// The first issue is usually the one the customer can fix, e.g. "Välj ett ombud"
		res.status(400).json({
			error: cart.error.issues[0]?.message ?? 'Ogiltig varukorg',
			details: z.prettifyError(cart.error),
		})
		return
	}

	// The chosen service point must be one of PostNord's service points for the postal code.
	// The name also comes from PostNord – never trust what React sends.
	let shipping = cart.data.shipping
	if (shipping.method === 'service_point') {
		let servicePoints
		try {
			servicePoints = await getNearestServicePoints({ postalCode: shipping.postalCode, limit: 10 })
		} catch (err) {
			console.error('[CHECKOUT] Could not verify service point:', err)
			res.status(502).json({ error: 'Kunde inte kontrollera ombudet just nu. Försök igen om en stund.' })
			return
		}

		const chosen = servicePoints.find((sp) => sp.id === shipping.servicePointId)
		if (!chosen) {
			res.status(400).json({ error: 'Det valda ombudet finns inte för postnumret. Välj ett ombud i listan.' })
			return
		}
		shipping = { ...shipping, servicePointName: chosen.name }
	}

	let order
	try {
		order = await createOrder(req.user.user_id, { ...cart.data, shipping })
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

/* --- GET /api/checkout/status?session_id=... → the order for the return page --- */
// Status comes from OUR db, set by the webhook. React only shows it.
router.get('/status', verifyToken, async (req, res, next) => {
	try {
		const { rows: [order] } = await pool.query(
			`SELECT o.id, o.stripe_status, o.grand_total, u.email,
			        o.shipping_method, o.shipping_cost, o.service_point_name
			 FROM order_ o
			 JOIN user_ u ON u.id = o.user_id
			 WHERE o.stripe_session_id = $1 AND o.user_id = $2`,
			[req.query.session_id, req.user.user_id]
		)
		if (!order) {
			res.status(404).json({ error: 'Ordern hittades inte' })
			return
		}

		// One row per unit in order_item → group them back into products with a quantity
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
			shipping: {
				method: order.shipping_method,
				label: SHIPPING_METHODS[order.shipping_method]?.label ?? null,
				cost: Number(order.shipping_cost ?? 0),
				servicePointName: order.service_point_name,
			},
		})
	} catch (err) {
		next(err)
	}
})

export default router