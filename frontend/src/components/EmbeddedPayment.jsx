// EMBEDDED: Stripe's payment form inside our page.
// The card details are typed into an iframe from Stripe – they never pass through our React code or our server.
import { useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'

// Call loadStripe OUTSIDE the component, so Stripe.js isn't loaded again on every render.
// The publishable key is public: it can only show the form, not create or change payments.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export default function EmbeddedPayment({ cart }) {
    // Stripe calls this function when the form is shown.
    // Our server creates the Checkout Session and returns its client secret.
    const fetchClientSecret = useCallback(async () => {
        const token = localStorage.getItem('token')

        const response = await fetch(`${import.meta.env.VITE_API_URL}/checkout/embedded`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                items: cart.map(({ id, quantity }) => ({ id, quantity })),
            }),
        })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error)
        return body.clientSecret
    }, [cart])

    return (
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
    )
}