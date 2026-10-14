import { useState } from "react";

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
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                console.error("Backend error:", errorData);
                throw new Error(`Importen från ${format.toUpperCase()} misslyckades.`);
            }

            const data = await res.json();
            setResult(data);

        } catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(null);
        }
    }

    return { runImport, result, loading, error };
}