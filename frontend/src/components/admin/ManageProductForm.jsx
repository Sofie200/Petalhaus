import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom";
import useProduct from "../../hooks/useProduct";
import ErrorMessage from "../ErrorMessage";
import Loading from "../Loading";

// Shown when the product was saved in the database, but Algolia didn't answer
const SEARCH_WARNING =
    "\n\nObs: sökindexet kunde inte uppdateras, så ändringen syns inte i sökningen än. " +
    "Gå till Sökindex på adminsidan och tryck på \"Indexera om alla produkter\".";

export default function ManageProductForm({ type }) {

    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const navigate = useNavigate();
    const { product, loading, error } = useProduct();

    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        price: 0,
        discount: 0,
        image: ""
    });

    useEffect(() => {

        if (product) {
            setForm({
                name: product.name ?? "",
                description: product.description ?? "",
                category: product.category ?? "",
                price: product.price,
                discount: product.discount ?? 0,
                image: product.image ?? ""
            });
        }
    }, [product]);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    }

    // "Saved!" – plus a warning if the search index wasn't updated
    function savedMessage(text, data) {
        return data?.searchIndexed === false ? text + SEARCH_WARNING : text;
    }

    async function handleSubmit(e) {

        e.preventDefault();

        if (type === "edit") {
            try {
                const res = await fetch(`${API}/products/${product.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(form)
                });

                if (!res.ok) {
                    throw new Error("Kunde inte uppdatera produkten");
                }

                const data = await res.json();

                alert(savedMessage("Produkten uppdaterades!", data));

                navigate(`/product/${product.id}`);

            } catch (err) {
                console.error(err);
                alert(err.message);
            }
        } else {
            try {
                const res = await fetch(`${API}/products`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                    body: JSON.stringify(form)
                });

                if (!res.ok) {
                    throw new Error("Kunde inte lägga till produkt");
                }

                const data = await res.json();

                alert(savedMessage("Produkten tillagd!", data));

                navigate(`/product/${data.id}`);

            } catch (err) {
                console.error(err);
                alert(err.message);
            }
        }
    }

    async function handleDelete() {
        const confirmed = window.confirm("Är du säker på att du vill radera denna produkt?");

        if (!confirmed) return;

        try {
            const res = await fetch(`${API}/products/${product.id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                throw new Error("Kunde inte radera produkten");
            }

            const data = await res.json();

            alert(
                data?.searchIndexed === false
                    ? "Produkten raderades, men den kunde inte tas bort ur sökindexet och syns därför fortfarande i sökningen. " +
                    "Gå till Sökindex på adminsidan och tryck på \"Indexera om alla produkter\"."
                    : "Produkten raderades!"
            );

            navigate("/");

        } catch (err) {
            alert(err.message);
        }
    }


    if (loading) return <Loading />;

    if (error) return <ErrorMessage message={error} />;

    if (type === "edit" && !product) {
        return <p>Produkten hittades ej.</p>;
    }

    return (
        <form onSubmit={handleSubmit}>

            <label>Namn</label>
            <input
                name="name"
                value={form.name}
                onChange={handleChange}
            />

            <label>Beskrivning</label>
            <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
            />

            <label>Kategori</label>
            <input
                name="category"
                value={form.category}
                onChange={handleChange}
            />

            <label>Pris</label>
            <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
            />

            <label>Rabatt</label>
            <input
                type="number"
                name="discount"
                value={form.discount}
                onChange={handleChange}
            />

            <label>Bild-URL</label>
            <input
                name="image"
                value={form.image}
                onChange={handleChange}
            />

            <div className="buttons">
                <button type="submit">{type === "edit" ? "Spara ändringar" : "Lägg till"}</button>
                {type === "edit" && (
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDelete}
                    >
                        Radera produkten
                    </button>
                )}
            </div>
        </form>
    );
}