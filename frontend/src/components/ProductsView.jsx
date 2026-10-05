import ProductsViewCard from "./ProductsViewCard";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";

export default function ProductsView({products, loading, error}) {

    return (
        <div>

            {loading && <Loading />}

            {error && <ErrorMessage message={error} />}

            {!error && !loading && products.length === 0 && (
                <p className="message">Inga produkter hittades</p>
            )}

            <div className="grid-container">
                {products.map(p => (
                    <ProductsViewCard key={p.id} product={ p } />
                ))}
            </div>
        </div>
    );
}
