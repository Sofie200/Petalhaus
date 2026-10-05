import { useState, useEffect } from "react";
import ProductsView from "../components/ProductsView"

const Products = () => {

    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const [products, setProducts] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {

        async function loadProducts() {
            setLoading(true);

            try {
                let url;

                if (!search || search.trim() === "") {
                    url = `${API}/products`;
                }

                else {
                    url = `${API}/products/search?search=${search}`;
                }

                const res = await fetch(url, {
                    headers: { "Authorization": `Bearer ${token}` },
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Produkter kan inte hämtas.");
                }

                const data = await res.json();
                setProducts(data);

            } catch (err) {
                setError(err.message);
                setProducts([]);
            } finally {
                setLoading(false);
                setError(null);
            }
        }

        loadProducts();

    }, [API, search, token]);

    return (
        <div>
            <input
                type="text"
                placeholder="Sök produkter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />            
            <ProductsView products={ products } loading={ loading } error={ error } />
        </div>
    )
}

export default Products
