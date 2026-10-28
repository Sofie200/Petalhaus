import { useState } from "react";
import EmbeddedPayment from "../components/EmbeddedPayment";
import ShippingPicker from "../components/ShippingPicker";
import { useShoppingCart } from "../contexts/ShoppingCart";
import { useAuth } from "../hooks/useAuth";
import "./Checkout.css";

const Checkout = () => {
    const { cart } = useShoppingCart();
    const { user } = useAuth();
    const [shipping, setShipping] = useState(null); // { method, postalCode, servicePointId?, servicePointName? }

    if (cart.length === 0) {
        return <p className="message">Din varukorg är tom.</p>;
    }

    if (!user) {
        return <p className="message">Du måste vara inloggad för att beställa.</p>;
    }

    // A new key creates a NEW Stripe session – needed when the cart or the delivery choice changes,
    // otherwise the payment form would still charge the old shipping cost
    const cartKey = cart.map((i) => `${i.id}:${i.quantity}`).join(",");
    const shippingKey = shipping ? `${shipping.method}:${shipping.postalCode}:${shipping.servicePointId ?? ""}` : "";

    return (
        <div>
            <h2>Beställ</h2>
            <div className="checkout-grid">
                
                <ShippingPicker cart={cart} onChange={setShipping} />

                {shipping && 
                    <EmbeddedPayment key={`${cartKey}|${shippingKey}`} cart={cart} shipping={shipping} />
                }
            </div>
        </div>
    );
};

export default Checkout;