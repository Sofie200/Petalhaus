import { useEffect, useState } from "react";
import { useParams } from "react-router-dom"

export default function useProduct() {

    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const { id } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        
        if (!id) {
            setLoading(false);
            return;
        }

        async function loadProduct() {
            try {
                const res = await fetch(`${API}/products/${id}`, {
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error("Produkter kan inte hämtas.");
                }

                const data = await res.json();
                setProduct(data);

            } catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        }

        loadProduct();
    }, [id, API, token]);

    return { product, loading, error, id };
}