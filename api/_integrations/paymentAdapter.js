// Adapter for the payment service (Stripe).
// This is the ONLY file that knows Stripe: keys, öre, line_items, ui_mode and the webhook signature.
// The rest of the shop only sees OUR model: an order id and its items in, a URL or a client secret out.
//
// Three parts:
//   1. Hosted:   Stripe's own payment page. We send the customer there with a URL.
//   2. Embedded: Stripe's payment form inside OUR page. React gets a client secret.
//   3. Webhook:  Stripe tells our server that the payment went through.
//
// TIMEOUT AND ERRORS – the common requirement in Labb 3:
// "Every call has a timeout. If the service is down, the user gets an understandable message, and the shop doesn't crash."
//   TIMEOUT 1  our server → Stripe   timeout + retries on the Stripe client below            -> we set it in code
//   TIMEOUT 2  the customer pays     the session expires (expires_at: 30 min – 24 h)         -> we set it in code (default 24 h)
//   TIMEOUT 3  Stripe → our webhook  Stripe's timeout on our answer – answer 200 quickly     -> Stripe, not in code
// When Stripe fails: the route catches the error and answers 502 with a clear message (routes/checkout.js),
// and React shows it. The order stays 'pending' – nothing is marked as paid.

import Stripe from 'stripe'

/**
 * One row of the order, with OUR price – the route fetches it from the database.
 * @typedef {Object} CheckoutItem
 * @property {string} name
 * @property {number} price    in SEK
 * @property {number} quantity
 */

const SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173'

// Only the secret key is needed to start. The webhook secret is checked in verifyWebhook(),
// so you can test hosted and embedded before you have started `stripe listen`.
if (!SECRET_KEY) {
	throw new Error('Stripe is not configured. Copy .env.example to .env and fill in STRIPE_SECRET_KEY.')
}

// The secret key may create payments. It is only used here, on the server.
//
// TIMEOUT 1: our server → Stripe (create sessions). We control this one here.
// The Stripe client has timeout and retries built in – what we wrote ourselves in fetchJson in L2.
// - timeout: 10 s per attempt. The default is 80 s – far too long for a customer waiting on a button.
//   Safe even for create: the client sends an idempotency key, so the same session is never created twice.
// Worst case: 3 attempts × 10 s ≈ 30 s. Then it throws, and the route answers 502 with a clear message.
const stripe = new Stripe(SECRET_KEY, { timeout: 10_000 })

/* --- 1. HOSTED: the customer pays on Stripe's page --- */

/**
 * @param {string} orderId
 * @param {CheckoutItem[]} items
 * @returns {Promise<{ sessionId: string, url: string | null }>}
 */

/**
 * Our order rows → Stripe's line_items. Stripe counts in öre: 599 kr = 59900.
 * @param {CheckoutItem[]} items
 */
function toLineItems(items) {
	return items.map((item) => ({
		quantity: item.quantity,
		price_data: {
			currency: 'sek',
			unit_amount: Math.round(Number(item.price) * 100), // round: 199.9 * 100 = 19989.999...
			product_data: { name: item.name },
		},
	}))
}

/*
export async function createHostedCheckout(orderId, items) {
  // Stripe's line_items, hardcoded here. In your shop: build them from `items` – the order's products
  // with the prices from YOUR database. One line item per product. Stripe counts in öre: 599 kr = 59900.
  console.log('[HOSTED] Order', orderId, '– items from the route:', items)
  const session = await stripe.checkout.sessions.create({
	mode: 'payment',
	line_items: [
	  {
		quantity: 1,
		price_data: { currency: 'sek', unit_amount: 59900, product_data: { name: 'Hoodie Svart' } },
	  },
	  {
		quantity: 2,
		price_data: { currency: 'sek', unit_amount: 19900, product_data: { name: 'T-shirt Vit' } },
	  },
	],
	// Our order id follows the payment, so the webhook knows which order was paid.
	client_reference_id: orderId,
	// Stripe replaces {CHECKOUT_SESSION_ID} with the session's id before sending the customer back.
	success_url: `${CLIENT_URL}/return?session_id={CHECKOUT_SESSION_ID}`,
	cancel_url: `${CLIENT_URL}/`,
	// TIMEOUT 2: how long the customer has to pay. WE set it here with expires_at – anything from
	// 30 min to 24 h. Without it, Stripe's default is 24 h. Stripe keeps the clock: when the time is up,
	// the session expires and our webhook gets checkout.session.expired.
	// E.g. 30 min, if the shop reserves stock (the time is in seconds since 1970):
	// expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  })
  console.log('\n[HOSTED] Checkout Session created:', session.id)

  // Stripe's page lives at this URL. React sends the customer there.
  return { sessionId: session.id, url: session.url }
}*/

/* --- 2. EMBEDDED: the customer pays in a Stripe form inside our page --- */

/**
 * @param {string} orderId
 * @param {CheckoutItem[]} items
 * @returns {Promise<{ sessionId: string, clientSecret: string | null }>}
 */
export async function createEmbeddedCheckout(orderId, items, customer={}) {
	// with the prices from YOUR database. One line item per product. Stripe counts in öre: 599 kr = 59900.

	console.log('[EMBEDDED] Order', orderId, '– items from the route:', items)

	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		ui_mode: 'embedded_page',
		line_items: toLineItems(items),
		client_reference_id: String(orderId),
		return_url: `${CLIENT_URL}/return?session_id={CHECKOUT_SESSION_ID}`,

		// Prefills the email field in the form
		customer_email: customer.email,

		// Shows up on the payment in the Stripe Dashboard
		metadata: { user_id: String(customer.userId ?? '') },

		// Optional: let Stripe collect a delivery address and phone number
		shipping_address_collection: { allowed_countries: ['SE'] },
		phone_number_collection: { enabled: true },
	})
	console.log('\n[EMBEDDED] Checkout Session created:', session.id)

	// The client secret lets React show THIS session's form. It is not the secret key.
	return { sessionId: session.id, clientSecret: session.client_secret }
}

/* --- 3. WEBHOOK: Stripe tells us that the payment went through --- */

/**
 * Checks that the request really comes from Stripe, and turns it into an event.
 * Throws if the signature is wrong – e.g. someone sending a fake "paid" with curl.
 * rawBody must be the bytes exactly as Stripe sent them: the signature is calculated on them.
 *
 * @param {Buffer} rawBody
 * @param {string} signature
 * @returns {import('stripe').Stripe.Event}
 */
export function verifyWebhook(rawBody, signature) {
	if (!WEBHOOK_SECRET) {
		throw new Error('STRIPE_WEBHOOK_SECRET is missing in .env. Copy the whsec_... that `stripe listen` prints.')
	}
	return stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET)
}