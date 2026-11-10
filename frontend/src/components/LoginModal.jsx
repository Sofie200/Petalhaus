import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";

const API = import.meta.env.VITE_API_URL;

// Native <dialog>: Esc closes it, focus stays inside, ::backdrop dims the page.
// With a notice (e.g. the email already belongs to a password account) the Google
// option is hidden – it would only fail again – and only the password form is shown.
export default function LoginModal({ open, onClose, notice }) {
    const dialogRef = useRef(null);
    const emailRef = useRef(null);
    const { refresh } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Sync the open prop with the dialog element
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            emailRef.current?.focus(); // otherwise the × button gets focus first
        }
        if (!open && dialog.open) dialog.close();
    }, [open]);

    // Runs on Esc, the × button, a backdrop click and after a successful login
    function handleClose() {
        setError("");
        setPassword("");
        onClose();
    }

    // A click directly on <dialog> (not its content) = a click on the backdrop
    function handleBackdropClick(e) {
        if (e.target === dialogRef.current) dialogRef.current.close();
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username: email, password }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || "Fel e-postadress eller lösenord");
                return;
            }

            await refresh();
            setEmail("");
            dialogRef.current?.close();
        } catch {
            setError("Något gick fel. Försök igen.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <dialog
            ref={dialogRef}
            className="login-modal"
            aria-labelledby="login-modal-title"
            onClose={handleClose}
            onClick={handleBackdropClick}
        >
            <div className="login-modal-content">
                <button
                    type="button"
                    className="login-modal-close"
                    aria-label="Stäng"
                    onClick={() => dialogRef.current?.close()}
                >
                    ×
                </button>

                {notice ? (
                    <>
                        <h2 id="login-modal-title">Kontot finns redan</h2>
                        <p className="login-modal-notice" role="alert">{notice}</p>
                    </>
                ) : (
                    <>
                        <h2 id="login-modal-title">Logga in</h2>
                        <p className="login-modal-lead">Välkommen tillbaka till Petalhaus.</p>

                        <a className="google-login" href={`${API}/auth/google`}>
                            Fortsätt med Google
                        </a>

                        <div className="login-divider" aria-hidden="true">eller</div>
                    </>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        E-post
                        <input
                            type="email"
                            value={email}
                            autoComplete="email"
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            ref={emailRef}
                        />
                    </label>

                    <label>
                        Lösenord
                        <input
                            type="password"
                            value={password}
                            autoComplete="current-password"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>

                    {error && <p className="login-error" role="alert">{error}</p>}

                    <button type="submit" disabled={loading}>
                        {loading ? "Loggar in…" : "Logga in"}
                    </button>
                </form>
            </div>
        </dialog>
    );
}
