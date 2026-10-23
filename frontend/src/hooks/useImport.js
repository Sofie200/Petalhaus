import { useState } from "react";

// Importen hämtar från leverantören (10 s timeout + retries) och sparar sedan – ge den gott om tid
const TIMEOUT_MS = 60_000;

export default function useImport() {

    const API = import.meta.env.VITE_API_URL;
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(null); // "csv" | "xml" | null
    const [error, setError] = useState(null);

    async function runImport(format) {
        setLoading(format);
        setError(null);
        setResult(null);

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API}/import/${format}`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                console.error("Backend error:", data);
                throw new Error(
                    res.status === 401 || res.status === 403
                        ? "Du har inte behörighet. Logga in igen som admin."
                        : res.status === 502
                            ? data?.error ?? "Leverantören svarar inte just nu. Försök igen om en stund."
                            : `Importen från ${format.toUpperCase()} misslyckades.`
                );
            }

            setResult(data);

        } catch (err) {
            setError(
                err.name === "TimeoutError"
                    ? "Importen tog för lång tid. Kontrollera rapporten genom att köra importen igen."
                    : err.name === "TypeError"
                        ? "Kunde inte nå servern. Kontrollera din anslutning."
                        : err.message
            );
        }
        finally {
            setLoading(null);
        }
    }

    return { runImport, result, loading, error };
}