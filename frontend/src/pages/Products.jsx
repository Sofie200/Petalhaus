import { useState, useEffect } from "react";
import ProductsView from "../components/ProductsView";

const Products = () => {
    const API = import.meta.env.VITE_API_URL;
    const [products, setProducts] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        // Vänta tills användaren slutat skriva en stund
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);

            try {
                const q = encodeURIComponent(search.trim());
                const res = await fetch(`${API}/search?q=${q}&pageSize=50`, {
                    signal: controller.signal,
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Produkter kan inte hämtas.");
                }

                const { data } = await res.json();
                setProducts(data);
            } catch (err) {
                if (err.name === "AbortError") return; // en nyare sökning tog över
                setError(err.message);
                setProducts([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [API, search]);

    return (
        <div>
            <input
                type="text"
                placeholder="Sök produkter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <ProductsView products={products} loading={loading} error={error} />
        </div>
    );
};

export default Products;