import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ProductsView from "../components/ProductsView";
import "./Products.css";

const PAGE_SIZE = 20;
const TIMEOUT_MS = 10_000;

// Our API's status code → a message the customer understands
function messageFor(status) {
    if (status === 400) return "Ogiltig sökning. Kontrollera söktexten.";
    if (status === 502) return "Sökningen är inte tillgänglig just nu. Försök igen om en stund.";
    return "Produkterna kunde inte hämtas.";
}

const Products = () => {
    const API = import.meta.env.VITE_API_URL;
    const [searchParams, setSearchParams] = useSearchParams();

    // URL:en är sanningen: /products?q=hoodie&page=2
    const q = searchParams.get("q") ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);

    const [input, setInput] = useState(q); // det som står i sökfältet just nu
    const [products, setProducts] = useState([]);
    const [meta, setMeta] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    // Bakåtknappen ändrar URL:en → uppdatera sökfältet
    useEffect(() => {
        setInput(q);
    }, [q]);

    // Skriv söktexten till URL:en när användaren slutat skriva en stund
    useEffect(() => {
        if (input === q) return;

        const timer = setTimeout(() => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    if (input.trim()) next.set("q", input);
                    else next.delete("q");
                    next.delete("page"); // ny sökning → sida 1
                    return next;
                },
                { replace: true } // varje tangenttryck ska inte bli ett steg i historiken
            );
        }, 300);

        return () => clearTimeout(timer);
    }, [input, q, setSearchParams]);

    // Hämta produkter när URL:en ändras
    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    q: q.trim(),
                    page: String(page),
                    pageSize: String(PAGE_SIZE),
                });

                const res = await fetch(`${API}/search?${params}`, {
                    // Avbryts antingen när användaren söker vidare, eller efter TIMEOUT_MS
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(TIMEOUT_MS)]),
                });

                if (!res.ok) {
                    const errorData = await res.json().catch(() => null);
                    console.error("Backend error:", errorData);
                    throw new Error(messageFor(res.status));
                }

                const { data, meta } = await res.json();
                setProducts(data);
                setMeta(meta);
            } catch (err) {
                if (err.name === "AbortError") return; // användaren sökte vidare – inget fel

                setError(
                    err.name === "TimeoutError"
                        ? "Sökningen tog för lång tid. Försök igen."
                        : err.name === "TypeError"
                            ? "Kunde inte nå servern. Kontrollera din anslutning."
                            : err.message
                );
                setProducts([]);
                setMeta(null);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [API, q, page]);

    const goToPage = (newPage) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (newPage > 1) next.set("page", String(newPage));
            else next.delete("page"); // håll URL:en ren på sida 1
            return next;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const totalPages = meta?.totalPages ?? 0;

    return (
        <div>
            <input
                type="search"
                placeholder="Sök produkter..."
                aria-label="Sök produkter"
                value={input}
                onChange={(e) => setInput(e.target.value)}
            />

            {meta && !loading && !error && (
                <p className="search-count" role="status">
                    {meta.total} {meta.total === 1 ? "produkt" : "produkter"}
                    {q.trim() && <> för "{q.trim()}"</>}
                </p>
            )}

            <ProductsView products={products} loading={loading} error={error} />

            {totalPages > 1 && (
                <nav className="page-nav" aria-label="Sidnavigering">
                    <button
                        onClick={() => goToPage(page - 1)}
                        disabled={page <= 1 || loading}
                        aria-label="Föregående sida"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
                    </button>
                    <span>
                        Sida {page} av {totalPages}
                    </span>
                    <button
                        onClick={() => goToPage(page + 1)}
                        disabled={page >= totalPages || loading}
                        aria-label="Nästa sida"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                    </button>
                </nav>
            )}
        </div>
    );
};

export default Products;