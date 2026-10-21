import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { createEmbeddedCheckout, createHostedCheckout } from '../_integrations/paymentAdapter.js'

const router = Router()

// React only sends WHAT the customer wants to buy – never the price.
// The expected request body:
//   {
//     "items": [
//       { "sku": "LEV-1001", "quantity": 1 },
//       { "sku": "LEV-1003", "quantity": 2 }
//     ]
//   }

// Zod validation: make sure the recieved data is an array with objects,
// every object has "sku: string" and "quantity: number"
const Cart = z.object({
  items: z
    .array(
      z.object({
        id: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1), // en tom varukorg ska inte kunna gå till kassan
})

// The cart → an order with OUR prices, saved as 'pending' BEFORE the customer pays.
function createOrder(cart) {
  // 1. In your shop: for each item React sent, fetch the product from the DB by its sku.
  //    The name and the price come from DB – never from React:
  //    - No product with that sku → answer 400
  //    - stock is lower than quantity → answer 400 (sold out)
  // In this example the products are hardcoded instead (same as the cart in React->App.jsx):
  const items = [
    { name: 'Hoodie Svart', price: 599, quantity: 1 },
    { name: 'T-shirt Vit', price: 199, quantity: 2 },
  ]
  console.log('\n[ORDER] Cart from React:', cart.items)

  // 2. In your shop: save the order in the DB as 'pending':
  // The webhook later uses these rows to mark the order as paid and lower the stock.
  const orderId = randomUUID() // in your shop: the id the DB gives the order
  console.log('[ORDER] Created (pending):', orderId, items)

  return { orderId, items }
}

/* --- HOSTED: POST /api/checkout/hosted  { items: [{ sku, quantity }] } → { url } --- */
router.post('/hosted', async (req, res) => {
  // 1. Validate the cart
  const cart = Cart.safeParse(req.body)
  if (!cart.success) {
    res.status(400).json({ error: 'Invalid cart', details: z.prettifyError(cart.error) })
    return
  }

  // 2. Create the order with OUR prices
  const order = createOrder(cart.data)

  // 3. Create the Checkout Session at Stripe
  try {
    const checkout = await createHostedCheckout(order.orderId, order.items)

    // 4. Save the session id on the order – crucial: the confirmation page gets ?session_id=... from Stripe,
    //    and uses it to find the order (GET /api/orders?stripe_session_id=...). It also helps to find the
    //    payment in the Stripe Dashboard. An UPDATE, because the session only exists after the order.
    //    In your shop:
    //      UPDATE orders SET stripe_session_id = $1 WHERE id = $2

    // 5. Answer with the URL to Stripe's payment page
    res.json({ url: checkout.url })
  } catch (err) {
    console.error('Could not create the Stripe Checkout Session:', err)
    res.status(502).json({ error: 'The payment service is not responding. Try again later.' })
  }
})

/* --- EMBEDDED: POST /api/checkout/embedded  { items: [{ sku, quantity }] } → { clientSecret } --- */
router.post('/embedded', async (req, res) => {
  // 1. Validate the cart
  const cart = Cart.safeParse(req.body)
  if (!cart.success) {
    res.status(400).json({ error: 'Invalid cart', details: z.prettifyError(cart.error) })
    return
  }

  // 2. Create the order with OUR prices
  const order = createOrder(cart.data)

  // 3. Create the Checkout Session at Stripe – with ui_mode: 'embedded_page'
  try {
    const checkout = await createEmbeddedCheckout(order.orderId, order.items)

    // 4. Save the session id on the order – crucial, the same as hosted. In your shop:
    //      UPDATE orders SET stripe_session_id = $1 WHERE id = $2

    // 5. Answer with the client secret, so React can show Stripe's form
    res.json({ clientSecret: checkout.clientSecret })
  } catch (err) {
    console.error('Could not create the Stripe Checkout Session:', err)
    res.status(502).json({ error: 'The payment service is not responding. Try again later.' })
  }
})

export default router