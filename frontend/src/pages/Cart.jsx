import { useShoppingCart } from "../contexts/ShoppingCart"
import ShoppingCartView from "../components/ShoppingCartView"

const Cart = () => {

    const { cart } = useShoppingCart();

    return (
        <div>

            {cart.length === 0 && (
                <p className="message">
                    Din varukorg är tom.
                </p>
            )}
            {cart.length !== 0 && (
                <>
                    <ShoppingCartView />
                </>
            )}
            
        </div>
    )
}

export default Cart
