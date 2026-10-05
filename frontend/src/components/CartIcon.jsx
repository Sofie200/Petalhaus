import { Link } from "react-router-dom"; 
import { useShoppingCart } from "../contexts/ShoppingCart";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCartShopping } from "@fortawesome/free-solid-svg-icons";

const CartIcon = () => {

    const { cart } = useShoppingCart();

    const count = cart.reduce((total, item) => total + item.quantity, 0);

    return (
        <div className="cart-icon-container">
            <Link to="/cart">
                <FontAwesomeIcon
                    icon={faCartShopping}
                    className="cart"
                    size="lg"
                /></Link>

            {cart.length > 0 &&
               <span className="badge">{count}</span>
            }
        </div>
    )
}

export default CartIcon
