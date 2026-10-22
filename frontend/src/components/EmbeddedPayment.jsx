// EMBEDDED: Stripe's payment form inside our page.
// The card details are typed into an iframe from Stripe – they never pass through our React code or our server.
import { useCallback, useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'

const PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const API = import.meta.env.VITE_API_URL

// Load Stripe.js once – but forget a failed attempt, so "Försök igen" can load it again
let stripePromise = null
function getStripe() {
    if (!stripePromise) {
        stripePromise = loadStripe(PUBLISHABLE_KEY).catch((err) => {
            stripePromise = null
            throw err
        })
    }
    return stripePromise
}

// Our server's answer → a message the customer understands
function messageFor(status, body) {
    if (status === 401) return 'Din inloggning har gått ut. Logga in igen för att betala.'
    if (status === 400) return body?.error ?? 'Något i varukorgen stämmer inte. Kontrollera den och försök igen.'
    if (status === 502) return body?.error ?? 'Betaltjänsten svarar inte just nu. Försök igen om en stund.'
    return 'Något gick fel när betalningen skulle startas. Försök igen.'
}

export default function EmbeddedPayment({ cart }) {
    const [stripe, setStripe] = useState(null)
    const [error, setError] = useState(null)
    const [attempt, setAttempt] = useState(0)

    // 1. Load Stripe.js
    useEffect(() => {
        if (!PUBLISHABLE_KEY) {
            console.error('VITE_STRIPE_PUBLISHABLE_KEY is missing')
            setError('Betalningen är inte konfigurerad. Kontakta butiken.')
            return
        }

        let cancelled = false
        getStripe()
            .then((instance) => {
                if (cancelled) return
                if (!instance) throw new Error('Stripe.js returned null')
                setStripe(instance)
            })
            .catch((err) => {
                console.error('Could not load Stripe.js:', err)
                if (!cancelled) {
                    setError('Betalformuläret kunde inte laddas. Kontrollera din anslutning, eller stäng av eventuell annonsblockerare, och försök igen.')
                }
            })

        return () => { cancelled = true }
    }, [attempt])

    // 2. Our server creates the Checkout Session – with a timeout and clear errors
    const fetchClientSecret = useCallback(async () => {
        try {
            const response = await fetch(`${API}/checkout/embedded`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    items: cart.map(({ id, quantity }) => ({ id, quantity })),
                }),
                // Our server waits max ~30 s on Stripe (3 × 10 s), so give up a little after that
                signal: AbortSignal.timeout(35_000),
            })

            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(messageFor(response.status, body))
            if (!body?.clientSecret) throw new Error(messageFor(500, body))

            return body.clientSecret
        } catch (err) {
            const message =
                err.name === 'TimeoutError'
                    ? 'Det tog för lång tid att starta betalningen. Försök igen.'
                    : err.name === 'TypeError'
                        ? 'Kunde inte nå servern. Kontrollera din anslutning och försök igen.'
                        : err.message

            setError(message) // shows our message instead of the empty form
            throw err         // tell Stripe it failed, too
        }
    }, [cart])

    function retry() {
        setError(null)
        setStripe(null)
        setAttempt((n) => n + 1)
    }

    if (error) {
        return (
            <div className="message error" role="alert">
                <p>{error}</p>
                <button onClick={retry}>Försök igen</button>
            </div>
        )
    }

    if (!stripe) {
        return <p className="message">Laddar betalningen…</p>
    }

    return (
        <EmbeddedCheckoutProvider
            key={attempt}
            stripe={stripe}
            options={{ fetchClientSecret }}
        >
            <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
    )
}