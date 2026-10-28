// The page Stripe sends the customer back to: /return?session_id=cs_test_...
// It only SHOWS how it went. It never marks the order as paid – the webhook does that.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShoppingCart } from '../contexts/ShoppingCart'

type OrderItem = { name: string; price: string; discount: string | null; quantity: number }
type Shipping = {
	method: 'service_point' | 'home' | null
	label: string | null
	cost: number
	servicePointName: string | null
}
type Order = {
	orderId: number
	status: 'pending' | 'paid' | 'cancelled'
	total: number
	email: string
	items: OrderItem[]
	shipping: Shipping
}

const API = import.meta.env.VITE_API_URL

const formatPrice = (kr: number) =>
	new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(kr)

// Same price rule as the server: discount is an amount in kr
const unitPrice = (item: OrderItem) => Number(item.price) - Number(item.discount ?? 0)

export default function ReturnPage() {
	const { clearCart } = useShoppingCart()
	const [order, setOrder] = useState<Order | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const sessionId = new URLSearchParams(window.location.search).get('session_id') ?? ''
		if (!sessionId) {
			setError('Ingen session hittades.')
			return
		}

		let attempts = 0
		let timer: ReturnType<typeof setTimeout>

		async function check() {
			try {
				const res = await fetch(
					`${API}/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
					{ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
				)
				const data = await res.json()
				if (!res.ok) throw new Error(data.error)

				setOrder(data)

				if (data.status === 'paid') {
					clearCart()
				} else if (data.status === 'pending' && attempts < 10) {
					// The webhook may arrive a moment after the customer – ask again
					attempts++
					timer = setTimeout(check, 2000)
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Något gick fel')
			}
		}

		check()
		return () => clearTimeout(timer)
	}, [])

	if (error) return <main><p>{error}</p></main>
	if (!order) return <main><p>Hämtar din order…</p></main>

	if (order.status === 'pending') {
		return <main><p>Vi bekräftar din betalning…</p></main>
	}

	if (order.status !== 'paid') {
		return (
			<main>
				<p>Betalningen genomfördes inte.</p>
				<Link to="/checkout">Tillbaka till kassan</Link>
			</main>
		)
	}

	const { shipping } = order

	return (
			<div>
				<h1>Tack för din beställning!</h1>
				<p>Ordernummer: {order.orderId}</p>
				<p>En bekräftelse skickas till {order.email}</p>

				<ul>
					{order.items.map((item) => (
						<li key={`${item.name}-${item.price}`}>
							{item.quantity} × {item.name} – {formatPrice(unitPrice(item))}
						</li>
					))}
				</ul>

				<br />

				<h4>Leverans</h4>
				<p>
					{shipping.label ?? 'Okänt leveranssätt'} –{' '}
					{shipping.cost === 0 ? 'Fri frakt' : formatPrice(shipping.cost)}
				</p>
				{shipping.method === 'service_point' && shipping.servicePointName && (
					<p>Hämtas hos: {shipping.servicePointName}</p>
				)}

				<p><strong>Totalt: {formatPrice(order.total)}</strong></p>

				<Link to="/">Fortsätt handla</Link>
			</div>
	)
}