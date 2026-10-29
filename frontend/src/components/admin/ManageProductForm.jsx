import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom";
import useProduct from "../../hooks/useProduct";
import ErrorMessage from "../ErrorMessage";
import Loading from "../Loading";
import "./ManageProductForm.css";

// Shown when the product was saved in the database, but Algolia didn't answer
const SEARCH_WARNING =
    "\n\nObs: sökindexet kunde inte uppdateras, så ändringen syns inte i sökningen än. " +
    "Gå till Sökindex på adminsidan och tryck på \"Indexera om alla produkter\".";

// Same rules as the server – checked here only to give a quick answer. The server decides.
const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const UPLOAD_TIMEOUT_MS = 30_000;

export default function ManageProductForm({ type }) {

    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const navigate = useNavigate();
    const { product, loading, error } = useProduct();
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        price: 0,
        discount: 0,
        stock: 0,
        image: "" // the current image URL – sent back unchanged on save, so it isn't wiped
    });

    const [imageFile, setImageFile] = useState(null);   // the file the admin picked, not uploaded yet
    const [previewUrl, setPreviewUrl] = useState(null); // local preview of that file
    const [imageError, setImageError] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {

        if (product) {
            setForm({
                name: product.name ?? "",
                description: product.description ?? "",
                category: product.category ?? "",
                price: product.price,
                discount: product.discount ?? 0,
                stock: product.stock ?? 0,
                image: product.image ?? ""
            });
        }
    }, [product]);

    // Free the preview's memory when it is replaced or the form closes
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    function handleChange(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    }

    function handleImageChange(e) {
        const file = e.target.files?.[0] ?? null;
        setImageError(null);

        if (!file) {
            setImageFile(null);
            setPreviewUrl(null);
            return;
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            setImageError("Bilden måste vara JPG eller PNG.");
            e.target.value = "";
            return;
        }

        if (file.size > MAX_IMAGE_SIZE) {
            setImageError(`Bilden är för stor. Max ${MAX_IMAGE_SIZE / (1024 * 1024)} MB.`);
            e.target.value = "";
            return;
        }

        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    }

    // "Saved!" – plus a warning if the search index wasn't updated
    function savedMessage(text, ...responses) {
        return responses.some((data) => data?.searchIndexed === false) ? text + SEARCH_WARNING : text;
    }

    // Our server's error → a message the admin understands
    async function errorFrom(res, fallback) {
        const data = await res.json().catch(() => null);
        if (res.status === 401 || res.status === 403) return "Du har inte behörighet. Logga in igen som admin.";
        return data?.error ?? fallback;
    }

    // Sends the picked file to OUR server, which uploads it to Supabase and saves it on the product
    async function uploadImage(productId) {
        const body = new FormData();
        body.append("image", imageFile);

        let res;
        try {
            res = await fetch(`${API}/image/upload/${productId}`, {
                method: "POST",
                // No Content-Type: the browser sets multipart/form-data with the right boundary itself
                headers: { "Authorization": `Bearer ${token}` },
                body,
                signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
            });
        } catch (err) {
            throw new Error(
                err.name === "TimeoutError"
                    ? "Uppladdningen av bilden tog för lång tid."
                    : "Kunde inte nå servern för att ladda upp bilden."
            );
        }

        if (!res.ok) {
            throw new Error(await errorFrom(res, "Bilden kunde inte laddas upp."));
        }

        return res.json(); // { url, path, searchIndexed }
    }

    async function handleSubmit(e) {

        e.preventDefault();
        setSaving(true);

        try {
            // 1. Save the product's fields
            const isEdit = type === "edit";
            const res = await fetch(isEdit ? `${API}/products/${product.id}` : `${API}/products`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(form)
            });

            if (!res.ok) {
                throw new Error(await errorFrom(res, isEdit ? "Kunde inte uppdatera produkten" : "Kunde inte lägga till produkt"));
            }

            const saved = await res.json();
            const productId = isEdit ? product.id : saved.id;

            // 2. Upload the image AFTER the product is saved – a new product needs its id first,
            //    and the upload must come last so the save above can't overwrite the new image URL.
            let uploaded = null;
            if (imageFile) {
                try {
                    uploaded = await uploadImage(productId);
                } catch (err) {
                    // The product IS saved – only the image failed. Say so, and go on.
                    alert(`Produkten sparades, men bilden kunde inte laddas upp: ${err.message}`);
                    navigate(`/product/${productId}`);
                    return;
                }
            }

            alert(savedMessage(isEdit ? "Produkten uppdaterades!" : "Produkten tillagd!", saved, uploaded));

            navigate(`/product/${productId}`);

        } catch (err) {
            console.error(err);
            alert(err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleRemoveImage() {
        const confirmed = window.confirm("Vill du ta bort produktens bild?");
        if (!confirmed) return;

        try {
            const res = await fetch(`${API}/image/delete/${product.id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` },
                signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
            });

            if (!res.ok) {
                throw new Error(await errorFrom(res, "Bilden kunde inte tas bort."));
            }

            const data = await res.json();
            setForm((prev) => ({ ...prev, image: "" }));
            alert(savedMessage("Bilden togs bort.", data));

        } catch (err) {
            alert(err.name === "TimeoutError" ? "Det tog för lång tid att ta bort bilden." : err.message);
        }
    }

    // Clears the picked file – nothing has been uploaded, so the server isn't involved
    function clearSelectedImage() {
        setImageFile(null);
        setPreviewUrl(null); // the effect above frees the old preview's memory
        setImageError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
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

    // The new picked file wins over the image already saved on the product
    const shownImage = previewUrl ?? form.image;

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

            <label htmlFor="stock">Lagersaldo</label>
            <input
                id="stock"
                type="number"
                name="stock"
                min="0"
                step="1"
                value={form.stock}
                onChange={handleChange}
            />

            <label htmlFor="image">
                Bild (JPG eller PNG, max 4 MB)
                {imageFile && <span className="fineprint"><br />Bilden laddas upp när du sparar.</span>}
            </label>
            {shownImage && (
                <div className="image-preview">
                    <img
                        src={shownImage}
                        alt={previewUrl ? "Förhandsvisning av ny bild" : `Bild på ${form.name}`}
                    />

                    {(imageFile || (type === "edit" && form.image)) && (
                        <button
                            type="button"
                            className="image-preview__remove"
                            onClick={imageFile ? clearSelectedImage : handleRemoveImage}
                            aria-label={imageFile ? "Ångra vald bild" : "Ta bort bilden"}
                            title={imageFile ? "Ångra vald bild" : "Ta bort bilden"}
                        >
                            <span className="material-symbols-outlined" aria-hidden="true">close</span>
                        </button>
                    )}
                </div>
            )}

            <input
                id="image"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageChange}
            />

            {imageError && <p role="alert" style={{ color: "crimson" }}>{imageError}</p>}


            <div className="buttons">
                <button type="submit" disabled={saving}>
                    {saving ? "Sparar…" : type === "edit" ? "Spara ändringar" : "Lägg till"}
                </button>
                {type === "edit" && (
                    <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDelete}
                        disabled={saving}
                    >
                        Radera produkten
                    </button>
                )}
            </div>
        </form>
    );
}