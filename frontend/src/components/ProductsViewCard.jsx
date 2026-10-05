import { Link } from "react-router-dom";
import { useCurrency } from "../contexts/CurrencyContext";

const ProductsViewCard = ({ product }) => {

    const { formatPrice } = useCurrency();

    return (

        <div className="card">
            <Link to={`/product/${product.id}`}>
                <div className="imageWrapper">
                    <img src={product.image} alt={product.name} />
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