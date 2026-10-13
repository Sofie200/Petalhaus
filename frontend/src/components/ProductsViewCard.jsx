import { Link } from "react-router-dom";
import { useCurrency } from "../contexts/CurrencyContext";

const ProductsViewCard = ({ product }) => {

    const { formatPrice } = useCurrency();
    const FALLBACK_IMAGE = "/images/dummy.png";

    return (

        <div className="card">
            <Link to={`/product/${product.id}`}>
                <div className="imageWrapper">
                    <img
                        src={product.image || FALLBACK_IMAGE}
                        alt={product.name}
                        onError={(e) => {
                            if (!e.currentTarget.src.endsWith(FALLBACK_IMAGE)) {
                                e.currentTarget.src = FALLBACK_IMAGE;
                            }
                        }}
                    />
                </div>
                <div className="title">{product.name}</div>
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
            </Link>
        </div>

    )
}

export default ProductsViewCard