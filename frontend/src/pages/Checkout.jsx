import EmbeddedPayment from "../components/EmbeddedPayment";
import { useShoppingCart } from "../contexts/ShoppingCart";
import { useAuth } from "../hooks/useAuth";

const Checkout = () => {
    const { cart } = useShoppingCart();
    const { user } = useAuth();

    if (cart.length === 0) {
        return <p className="message">Din varukorg är tom.</p>;
    }

    if (!user) {
        return <p className="message">Du måste vara inloggad för att beställa.</p>;
    }

    const cartKey = cart.map((i) => `${i.id}:${i.quantity}`).join(",");

    return (
        <div>
            <EmbeddedPayment key={cartKey} cart={cart} />
        </div>
    );
};

export default Checkout;