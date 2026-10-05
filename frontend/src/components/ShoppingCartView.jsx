import { useShoppingCart } from "../contexts/ShoppingCart";
import { Link } from "react-router-dom"
import { useAuth } from "../hooks/useAuth";
import { useCurrency } from "../contexts/CurrencyContext";

const ShoppingCartView = () => {

    const { cart, removeFromCart } = useShoppingCart();
    const { user } = useAuth();
    const { formatPrice } = useCurrency();

    const total = cart.reduce((sum, product) => {
        const price = product.price - product.discount
        return sum + price * product.quantity
    }, 0)

    return (

        <div>
            <h2>Din varukorg</h2>

            <div className="cart-container">
                <table>
                    <thead>
                        <tr>
                            <th className="nomob"></th>
                            <th></th>
                            <th align="right">Antal</th>
                            <th align="right">Pris/st.</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {cart.map(product => (
                            <tr key={product.id} >
                                <td align="center" className="thumbnail nomob"><img src={product.image} /></td>
                                <td><h4><Link to={`/product/${product.id}`}>{product.name}</Link></h4></td>
                                <td align="right">
                                    <p>{product.quantity}</p>
                                </td>
                                <td align="right">
                                    <p>

                                        {product.discount > 0 ? (
                                            <>
                                                <span className="discounted">
                                                    {formatPrice(product.price - product.discount)}
                                                </span>
                                            </>
                                        ) : (
                                                <span>{formatPrice(Math.round(product.price))}</span>
                                        )}

                                    </p>
                                </td>
                                <td align="right">
                                    <button onClick={() => removeFromCart(product)} className="btn-danger">
                                        X
                                    </button>
                                </td>
                            </tr>
                        ))}
                        <tr>
                            <td className="total-row nomob"></td>
                            <td className="total-row" colSpan={3} align="right">
                                <strong>Totalt: {formatPrice(total)}</strong>
                            </td>
                            <td className="total-row" align="right">

                            </td>
                        </tr>
                    </tbody>
                </table>



            </div>

            {user &&
                <Link to="/checkout" className="btn">
                    Beställ
                </Link>
            }

            {!user &&
                <p className="message">Logga in för att lägga en beställning.</p>
            }
        </div>
    )
}

export default ShoppingCartView
