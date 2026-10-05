import { Link } from "react-router-dom"
import useProduct from "../hooks/useProduct";
import { useAuth } from "../hooks/useAuth";
import { useShoppingCart } from "../contexts/ShoppingCart";
import { useCurrency } from "../contexts/CurrencyContext";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";

export default function ProductDetails() {

    const { product, loading, error } = useProduct();
    const { user } = useAuth();
    const { addToCart, getItemQuantity, updateItemQuantity } = useShoppingCart();
    const { formatPrice } = useCurrency();

    let quantity = "";

    if(!loading){
        quantity = getItemQuantity(product.id);
    }

    if (loading) return <Loading />;

    if (error) return <ErrorMessage message={error} />;

    if (!product) {
        return <p>Produkten hittades ej.</p>;
    }

    return (
        <section>
            <div className="product-image">
                <img src={product.image} alt={product.name} />
                {user?.role === "admin" && (
                    <Link
                        to={`/admin/manage-product/${product.id}`}
                        className="btn btn-manage"
                    >
                        Hantera
                    </Link>
                )}
            </div> 
            <div className="product-details">
                <h2>{product.name}</h2>
                <p>{product.description}</p>
                <div className="price">
                    {product.discount > 0 ? (
                        <>
                            <span className="discounted">
                                {formatPrice(product.price - product.discount)}
                            </span>
                            &nbsp;<s className="original">{formatPrice(Math.round(product.price))}</s>
                        </>
                    ) : (
                            <span>{formatPrice(Math.round(product.price))}</span>
                    )}
                </div>
                {quantity === 0 ? (
                    <button onClick={() => addToCart(product)}>
                        Lägg i varukorgen
                    </button>
                ) : (
                    <div className="change-quantity">
                        <button onClick={() => updateItemQuantity(product.id, quantity - 1)}>-</button>
                        <span className="quantity">{quantity}</span>
                        <button onClick={() => updateItemQuantity(product.id, quantity + 1)}>+</button>
                    </div>
                )}
            </div>
        </section>
    );
}
