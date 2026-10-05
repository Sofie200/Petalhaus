import { useShoppingCart } from "../contexts/ShoppingCart";
import { useCurrency } from "../contexts/CurrencyContext";
import UserDetails from "../components/UserDetails"

export default function OrderItemsView({handleCheckout}){

    const { cart } = useShoppingCart();
    const { formatPrice } = useCurrency();

    const total = cart.reduce((sum, product) => {
        const price = product.price - product.discount;
        return sum + price * product.quantity;
    }, 0);

    return (
        <div>
            <h2>Lägg Beställning</h2>

            <div className="cart-container">
                <table>
                    <tr>
                        <th className="nomob"></th>
                        <th></th>
                        <th align="right">Antal</th>
                        <th align="right">Pris/st.</th>
                        <th></th>
                    </tr>
                    {cart.map(product => (
                        <tr key={product.id} >
                            <td align="center" className="thumbnail nomob"><img src={product.image} /></td>
                            <td><h4>{product.name}</h4></td>
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
                        </tr>
                    ))}
                    <tr>
                        <td className="total-row nomob"></td>
                        <td className="total-row" colSpan={3} align="right">
                            <strong>Totalt: {formatPrice(total)}</strong>

                        </td>
                    </tr>
                    <tr>
                        <td className="total-row nomob"></td>
                        <td className="total-row" colSpan={3} align="left">

                            <UserDetails />

                        </td>
                    </tr>
                </table>
            </div>

            <button onClick={handleCheckout}>
                Bekräfta
            </button>

        </div>
    )
}

