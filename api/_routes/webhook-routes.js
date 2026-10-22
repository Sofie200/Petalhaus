import express, { Router } from 'express'
import { pool } from '../_db/pool.js'
import { verifyWebhook } from '../_integrations/paymentAdapter.js'

const router = Router()

async function markPaid(orderId) {
	const client = await pool.connect()
	try {
		await client.query('BEGIN')

		const { rowCount } = await client.query(
			"UPDATE order_ SET stripe_status = 'paid' WHERE id = $1 AND stripe_status = 'pending'",
			[orderId]
		)

		// 0 rows = already handled (Stripe resent the event). Don't lower stock twice.
		if (rowCount === 0) {
			await client.query('ROLLBACK')
			return false
		}

		// One row per unit in order_items → COUNT(*) is the quantity per product
		await client.query(
			`UPDATE product p
       SET stock = p.stock - oi.qty
       FROM (
         SELECT product_id, COUNT(*) AS qty
         FROM order_item
         WHERE order_id = $1
         GROUP BY product_id
       ) oi
       WHERE p.id = oi.product_id`,
			[orderId]
		)

		await client.query('COMMIT')
		return true
	} catch (err) {
		await client.query('ROLLBACK')
		throw err
	} finally {
		client.release()
	}
}

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
	const signature = req.headers['stripe-signature']
	if (typeof signature !== 'string') {
		res.status(400).send('Missing Stripe-Signature')
		return
	}

	let event
	try {
		event = verifyWebhook(req.body, signature)
	} catch (err) {
		console.error('Webhook signature verification failed:', err)
		res.status(400).send('Invalid signature')
		return
	}
	console.log('\n[WEBHOOK] Event:', event.type, event.id)

	try {
		switch (event.type) {
			case 'checkout.session.completed':
			case 'checkout.session.async_payment_succeeded': {
				const session = event.data.object
				if (session.payment_status !== 'paid') break

				const updated = await markPaid(session.client_reference_id)
				console.log(
					updated ? '[WEBHOOK] Order paid:' : '[WEBHOOK] Already paid, skipped:',
					session.client_reference_id
				)
				break
			}

			case 'checkout.session.expired': {
				const session = event.data.object
				await pool.query(
					"UPDATE order_ SET stripe_status = 'cancelled' WHERE id = $1 AND stripe_status = 'pending'",
					[session.client_reference_id]
				)
				console.log('[WEBHOOK] Order cancelled (expired):', session.client_reference_id)
				break
			}

			default:
				console.log('[WEBHOOK] Ignored event type:', event.type)
		}
	} catch (err) {
		// DB error → 500 so Stripe retries later. Safe thanks to "AND status = 'pending'".
		console.error('[WEBHOOK] Failed to handle event:', err)
		res.status(500).send('Handler error')
		return
	}

	res.json({ received: true })
})

export default router