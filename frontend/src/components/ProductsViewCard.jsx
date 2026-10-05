import { Link } from "react-router-dom";

const ProductsViewCard = ({ product }) => {

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
                                {product.price - product.discount} kr
                            </span>
                            &nbsp;<s className="original">{Math.round(product.price)} kr</s>
                        </>
                    ) : (
                            <span>{Math.round(product.price)} kr</span>
                    )}
                </div>
            </Link>
        </div>

    )
}

export default ProductsViewCard