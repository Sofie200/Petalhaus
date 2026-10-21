// The page Stripe sends the customer back to: /return?session_id=cs_test_...
// It only SHOWS how it went. It never marks the order as paid – the webhook does that.
import { useEffect } from 'react'


export default function ReturnPage() {
  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id') ?? ''
    console.log('Back from Stripe, session:', sessionId)
    // In your shop: fetch the order (and the customer) from your shop's OWN endpoints – not from Stripe.
    // The order's status in your database is the one the webhook set:
    //   'paid' → "Thank you, your order is paid"
    //   'pending' → "Waiting for confirmation…" (the webhook may arrive a moment after the customer)
    // e.g. GET /api/orders?stripe_session_id=${sessionId}
    //   – or put your order id in success_url/return_url in paymentAdapter.ts and use GET /api/orders/:id
  }, [])

  return (
    <main>
      <h1>Thank you for your order!</h1>
      <p>User info: "fetched from DB"</p>
      <p>Product info: "fetched from DB"</p>
      <p>Total: "fetched from DB" kr</p>
    </main>
  )
}
