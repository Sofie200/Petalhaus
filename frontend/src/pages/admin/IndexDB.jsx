import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const API = import.meta.env.VITE_API_URL;

const IndexDB = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState("idle"); // idle | loading | success | error
    const [message, setMessage] = useState("");

    if (user?.role !== "admin") return null;

    async function handleReindex() {
        setStatus("loading");
        setMessage("");

        try {
            const res = await fetch(`${API}/products/reindex`, {
                method: "POST",
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                // Hela katalogen kan ta en stund, men inte hur länge som helst
                signal: AbortSignal.timeout(60_000),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok) {
                throw new Error(
                    res.status === 401 || res.status === 403
                        ? "Du har inte behörighet. Logga in igen som admin."
                        : data?.error ?? "Indexeringen misslyckades."
                );
            }

            setStatus("success");
            setMessage(`Klart! ${data.count} produkter är indexerade.`);
        } catch (err) {
            setStatus("error");
            setMessage(
                err.name === "TimeoutError"
                    ? "Det tog för lång tid. Kontrollera sökningen om en stund, eller försök igen."
                    : err.name === "TypeError"
                        ? "Kunde inte nå servern."
                        : err.message
            );
        }
    }

    return (
        <>
            <h2>Indexera om databasen</h2>
            <p>
                Synkar Algolia med databasen så att produktsökningar speglar det exakta sortimentet. Används om du
                har gjort ändringar direkt i databasen.
            </p>

            <button onClick={handleReindex} disabled={status === "loading"}>
                {status === "loading" ? "Indexerar…" : "Indexera om alla produkter"}
            </button>

            {message && (
                <p
                    className={`message ${status === "error" ? "error" : "success"}`}
                    role={status === "error" ? "alert" : "status"}
                >
                    {message}
                </p>
            )}
        </>
    );
};

export default IndexDB;