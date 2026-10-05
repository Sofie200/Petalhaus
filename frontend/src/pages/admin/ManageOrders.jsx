import { useState, useEffect } from "react";
import Loading from "../../components/Loading"
import ErrorMessage from "../../components/Loading"

const ManageOrders = () => {

    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const [orders, setOrders] = useState([]);
    const [editedOrders, setEditedOrders] = useState({});
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [orderDetails, setOrderDetails] = useState(null);
    const [showPopup, setShowPopup] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);


    const ORDER_STATUSES = [
        "Beställd",
        "Behandlas",
        "Levererad",
        "Återbetald"
    ];

    function handleStatusChange(orderId, newStatus) {
        setEditedOrders(prev => ({
            ...prev,
            [orderId]: newStatus
        }));
    }

    async function loadOrderDetails(orderId) {
        try {
            const res = await fetch(`${API}/orders/${orderId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Kunde inte hämta orderdetaljer.");
            }

            const data = await res.json();
            setOrderDetails(data);
            setSelectedOrder(orderId);
            setShowPopup(true);   // ⭐ öppna popupen

        } catch (err) {
            setError(err.message);
        }
    }

    async function saveOrderStatus(orderId, newStatus) {
        try {
            const res = await fetch(`${API}/orders/${orderId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                console.error("Backend error:", errorData);
                throw new Error("Kunde inte uppdatera orderstatus.");
            }

            // Uppdatera UI lokalt
            setOrders(prev =>
                prev.map(order =>
                    order.id === orderId
                        ? { ...order, status: newStatus }
                        : order
                )
            );

            // Ta bort från editedOrders (valfritt)
            setEditedOrders(prev => {
                const updated = { ...prev };
                delete updated[orderId];
                return updated;
            });

        } catch (err) {
            setError(err.message);
            console.log(err.message);
        }
    }

    useEffect(() => {

        async function loadOrders() {
            try {
                const res = await fetch(`${API}/orders/`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Orders kan inte hämtas.");
                }

                const data = await res.json();
                setOrders(data);

            } catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        }

        loadOrders();

    }, [API, token]);

    return (
        <>
            <h2>Orderhantering</h2>

            {loading && <Loading />}

            {error && <ErrorMessage message={error} />}

            {!error && !loading && orders.length === 0 && (
                <p>Inga orders hittades</p>
            )}
            <div className="order-container">
                {!error && !loading && orders.length !== 0 && (
                    <table className="orders-table">
                        <thead className="nomob">
                            <tr>
                                <th align="center">ID</th>
                                <th align="left">Status</th>
                                <th align="left">Datum</th>
                                <th align="left">Kund</th>
                                <th></th>
                                <th></th>
                            </tr>
                        </thead>

                        <tbody>
                            {orders.map(order => {
                                const currentStatus =
                                    editedOrders[order.id] ?? order.status;

                                return (
                                    <tr key={order.id}>
                                        <td align="center">{order.id}</td>

                                        <td>
                                            <select
                                                value={currentStatus}
                                                onChange={e =>
                                                    handleStatusChange(order.id, e.target.value)
                                                }
                                            >
                                                {ORDER_STATUSES.map(status => (
                                                    <option key={status} value={status}>
                                                        {status}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td>
                                            {new Date(order.date).toLocaleDateString("sv-SE")}
                                        </td>

                                        <td>
                                            {order.first_name} {order.last_name}


                                        </td>
                                        <td>
                                            <button onClick={() => saveOrderStatus(order.id, currentStatus)}>
                                                Spara
                                            </button>
                                        </td>
                                        <td>
                                            <button onClick={() => loadOrderDetails(order.id)}>
                                                Visa detaljer
                                            </button>

                                        </td>
                                    </tr>

                                );
                            })}
                        </tbody>
                    </table>

                )}

            </div>

            {showPopup && orderDetails && (
                <div className="modal-overlay" onClick={() => setShowPopup(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h3>Order #{selectedOrder}</h3>

                        <div className="order-container-modal">
                            <table>
                                <thead>
                                    <tr>
                                        <th align="center">ID</th>
                                        <th align="left">Namn</th>
                                        <th align="right">Pris</th>
                                        <th align="right">Rabatt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderDetails.map(item => (
                                        <tr key={item.product_id}>
                                            <td align="center">{item.product_id}</td>
                                            <td>{item.name}</td>
                                            <td align="right">{item.price} kr</td>
                                            <td align="right">{item.discount} kr</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button onClick={() => setShowPopup(false)}>Stäng</button>
                    </div>
                </div>
            )}

        </>
    );
}

export default ManageOrders
