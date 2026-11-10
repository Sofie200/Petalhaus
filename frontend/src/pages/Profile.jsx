import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext';
import Loading from '../components/Loading';
import ErrorMessage from '../components/ErrorMessage';
import './Profile.css';

const API = import.meta.env.VITE_API_URL;

const SHIPPING_LABELS = {
    service_point: 'Ombud',
    home: 'Hemleverans',
};

const unitPrice = (item) => Number(item.price) - Number(item.discount ?? 0);

const formatDate = (date) =>
    new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });

const Profile = () => {
    const { user, logout } = useAuth();
    const { formatPrice } = useCurrency();
    const [searchParams] = useSearchParams();

    const [orders, setOrders] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        async function getOrders() {
            try {
                const res = await fetch(`${API}/user/me/orders`, { credentials: 'include' });

                if (res.status === 401) {
                    setError('Du behöver logga in för att se dina beställningar.');
                    return;
                }
                if (!res.ok) throw new Error();

                setOrders(await res.json());
            } catch {
                setError('Kunde inte hämta dina beställningar. Försök igen senare.');
            }
        }
        getOrders();
    }, []);

    return (
        <div className="my-pages">

            <div className="my-pages-header">
                <div>
                    <p className="my-pages-eyebrow">Mina sidor</p>
                    <h2>Hej, {user?.username}!</h2>
                </div>
                <button className="btn-outline" onClick={logout}>Logga ut</button>
            </div>

            {searchParams.get('linked') && (
                <p className="my-pages-notice" role="status">
                    Ditt Google-konto är nu kopplat. Logga in med Google nästa gång.
                </p>
            )}

            <div className="my-pages-orders">
                <h3>
                    Mina beställningar
                    {orders?.length > 0 && <span className="order-count">{orders.length}</span>}
                </h3>

                {error && <ErrorMessage message={error} />}
                {!error && orders === null && <Loading />}

                {orders?.length === 0 && (
                    <div className="my-pages-card empty-orders">
                        <p>Du har inga beställningar än.</p>
                        <Link className="btn" to="/">Till sortimentet</Link>
                    </div>
                )}

                {orders?.map((order) => (
                    <article key={order.id} className="my-pages-card order-card">
                        <div className="order-card-head">
                            <div>
                                <h4>Order #{order.id}</h4>
                                {order.date && (
                                    <time className="order-date" dateTime={order.date}>
                                        {formatDate(order.date)}
                                    </time>
                                )}
                            </div>
                            <span className="pill pill-status">{order.status ?? 'Betald'}</span>
                        </div>

                        <ul className="order-lines">
                            {order.items.map((item, index) => (
                                <li key={index}>
                                    <span>
                                        <span className="order-qty">{item.quantity} ×</span> {item.name}
                                    </span>
                                    <span>{formatPrice(unitPrice(item) * item.quantity)}</span>
                                </li>
                            ))}

                            {order.shipping_method && (
                                <li className="order-shipping">
                                    <span>
                                        Frakt – {SHIPPING_LABELS[order.shipping_method] ?? order.shipping_method}
                                        {order.service_point_name && ` (${order.service_point_name})`}
                                    </span>
                                    <span>
                                        {Number(order.shipping_cost) > 0
                                            ? formatPrice(Number(order.shipping_cost))
                                            : 'Fri frakt'}
                                    </span>
                                </li>
                            )}
                        </ul>

                        <div className="order-total">
                            <span>Totalt</span>
                            <strong>{formatPrice(Number(order.grand_total))}</strong>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
};

export default Profile;
