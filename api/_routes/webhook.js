import express, { Router } from 'express'
import { verifyWebhook } from '../_integrations/paymentAdapter.js'

const router = Router()

/* --- WEBHOOK: POST /api/stripe/webhook – called by STRIPE, not by React --- */
// express.raw: keep the body as raw bytes. The signature is calculated on the bytes exactly as Stripe
// sent them. After express.json() they are gone, and the verification always fails.
// That's why this router is registered BEFORE app.use(express.json()) in index.js.
router.post('/', express.raw({ type: 'application/json' }), (req, res) => {
  // 1. Verify that the request comes from Stripe
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
    res.status(400).send('Invalid signature') // not from Stripe – ignore it
    return
  }
  console.log('\n[WEBHOOK] Event:', event.type, event.id)

  // 2. Handle the events we care about. Stripe sends many others – we ignore them.
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session = event.data.object

      // A completed session isn't always paid: bank transfers are paid later (async_payment_succeeded).
      if (session.payment_status !== 'paid') break

      // Our order id, which followed the payment (client_reference_id in paymentAdapter.js)
      const orderId = session.client_reference_id

      // In your shop – the order status and the stock, in ONE database transaction,
      // so they can never disagree:
      // 1. Mark the order as paid, but only if it is still pending:
      //      UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'pending'
      //    0 rows updated? The order is already paid – Stripe sent the same event again. Stop here,
      //    otherwise the stock goes down twice.
      // 2. Lower the stock for each product in the order (the rows saved in order_items):
      //      UPDATE products SET stock = stock - $quantity WHERE sku = $sku
      // 3. After that, e.g. send a confirmation email – after answering Stripe, or in a queue.
      console.log('[WEBHOOK] Order paid:', orderId)
      break
    }

    // The customer never paid: the Checkout Session expired (after 24 hours by default).
    case 'checkout.session.expired': {
      const session = event.data.object
      const orderId = session.client_reference_id

      // In your shop: cancel the order, but only if it is still pending –
      // an order that is already paid is never cancelled:
      //   UPDATE orders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'
      // If the shop reserves stock when the order is created: give it back here, in the same transaction.
      console.log('[WEBHOOK] Order cancelled (session expired):', orderId)
      break
    }

    default:
      console.log('[WEBHOOK] Ignored event type:', event.type)
  }

  // 3. Answer 200 quickly. Otherwise Stripe thinks the delivery failed and sends the event again.
  //
  // TIMEOUT 3: Stripe → our server. Here STRIPE has a timeout on OUR answer – we can't change it in code.
  // - Keep the webhook short: update the order and answer. Slow work (e.g. emails) goes after the answer or in a queue.
  // - No 2xx in time? Stripe retries the event later, with longer and longer pauses (in live mode for days).
  //   "AND status = 'pending'" above makes that safe: the second time, nothing is updated.
  // - The Stripe Dashboard (Workbench → Webhooks) shows every delivery, its status code and when Stripe
  //   will retry – and you can resend an event by hand from there.
  res.json({ received: true })
})

export default router