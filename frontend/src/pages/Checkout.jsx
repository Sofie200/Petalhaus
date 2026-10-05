import OrderItemsView from "../components/OrderItemsView"
import { useShoppingCart } from "../contexts/ShoppingCart";
import { useAuth } from "../hooks/useAuth";

const Checkout = () => {
    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const { cart, clearCart } = useShoppingCart();
    const { user } = useAuth();

    async function handleCheckout() {
        if (!user) {
            alert("Du måste vara inloggad för att beställa.");
            return;
        }

        // Calculate grand total
        const grand_total = cart.reduce(
            (acc, item) => acc + item.sum,
            0
        );

        // Create order
        const orderRes = await fetch(`${API}/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({
                user_id: user.user_id,
                grand_total
            })
        });

        const orderData = await orderRes.json();
        const order_id = orderData[0].id;

        // Create order_items
        for (const item of cart) {
            for (let i = 0; i < item.quantity; i++) {
                await fetch(`${API}/checkout/item`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify({
                        order_id,
                        product_id: item.id,
                        price: item.price,
                        discount: item.discount
                    })
                });
            }
        }

        // Empty cart
        clearCart();

        // Thank you
        alert("Tack för din beställning!");

    }

    return (
        <div>

            {cart.length === 0 && (
                <p className="message">
                    Din varukorg är tom.
                </p>
            )}
            {cart.length !== 0 && (
                <>
                    <OrderItemsView handleCheckout={handleCheckout} />
                </>
            )}
            
        </div>
    );
};

export default Checkout;
