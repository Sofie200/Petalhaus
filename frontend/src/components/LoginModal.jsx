import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle, faGithub } from "@fortawesome/free-brands-svg-icons";

const API = import.meta.env.VITE_API_URL;

const EMPTY_FORM = { first_name: "", last_name: "", email: "", password: "" };

// Native <dialog>: Esc closes it, focus stays inside, ::backdrop dims the page.
// Two modes: "login" and "register". With a notice (e.g. the email already belongs
// to a password account) only the password login is shown – Google would fail again.
export default function LoginModal({ open, onClose, notice }) {
    const dialogRef = useRef(null);
    const firstFieldRef = useRef(null);
    const { refresh } = useAuth();

    const [mode, setMode] = useState("login");
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const isRegister = mode === "register" && !notice;

    // Sync the open prop with the dialog element
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            firstFieldRef.current?.focus(); // otherwise the × button gets focus first
        }
        if (!open && dialog.open) dialog.close();
    }, [open]);

    // Put the cursor in the first field when switching between login and register
    useEffect(() => {
        if (dialogRef.current?.open) firstFieldRef.current?.focus();
    }, [mode]);

    // Runs on Esc, the × button, a backdrop click and after success
    function handleClose() {
        setError("");
        setForm((f) => ({ ...EMPTY_FORM, email: f.email }));
        setMode("login");
        onClose();
    }

    // A click directly on <dialog> (not its content) = a click on the backdrop
    function handleBackdropClick(e) {
        if (e.target === dialogRef.current) dialogRef.current.close();
    }

    function switchMode(next) {
        setError("");
        setForm((f) => ({ ...f, password: "" }));
        setMode(next);
    }

    const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const request = isRegister
            ? { url: `${API}/register`, body: form, fallback: "Kontot kunde inte skapas" }
            : {
                url: `${API}/login`,
                body: { username: form.email, password: form.password },
                fallback: "Fel e-postadress eller lösenord",
            };

        try {
            const res = await fetch(request.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(request.body),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data.success) {
                setError(data.error || request.fallback);
                return;
            }

            await refresh();
            setForm(EMPTY_FORM);
            dialogRef.current?.close();
        } catch {
            setError("Något gick fel. Försök igen.");
        } finally {
            setLoading(false);
        }
    }

    const title = notice ? "Kontot finns redan" : isRegister ? "Skapa konto" : "Logga in";
    const lead = isRegister
        ? "Bli kund hos Petalhaus och se dina beställningar under Mina sidor."
        : "Välkommen tillbaka till Petalhaus.";
    const submitLabel = isRegister
        ? (loading ? "Skapar konto…" : "Skapa konto")
        : (loading ? "Loggar in…" : "Logga in");

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

                <h2 id="login-modal-title">{title}</h2>

                {notice ? (
                    <p className="login-modal-notice" role="alert">{notice}</p>
                ) : (
                    <>
                        <p className="login-modal-lead">{lead}</p>

                        <div className="social-logins">
                            <a className="social-login social-login--google" href={`${API}/auth/google`}>
                                <FontAwesomeIcon icon={faGoogle} className="social-login-icon" />
                                <span>Fortsätt med Google</span>
                            </a>

                            <a className="social-login social-login--github" href={`${API}/auth/github`}>
                                <FontAwesomeIcon icon={faGithub} className="social-login-icon" />
                                <span>Fortsätt med GitHub</span>
                                <span className="social-login-tag">Admin</span>
                            </a>
                        </div>

                        <div className="login-divider" aria-hidden="true">eller</div>
                    </>
                )}

                <form className="login-form" onSubmit={handleSubmit}>
                    {isRegister && (
                        <div className="login-form-row">
                            <label>
                                Förnamn
                                <input
                                    type="text"
                                    value={form.first_name}
                                    autoComplete="given-name"
                                    onChange={update("first_name")}
                                    maxLength={50}
                                    required
                                    ref={firstFieldRef}
                                />
                            </label>
                            <label>
                                Efternamn
                                <input
                                    type="text"
                                    value={form.last_name}
                                    autoComplete="family-name"
                                    onChange={update("last_name")}
                                    maxLength={50}
                                    required
                                />
                            </label>
                        </div>
                    )}

                    <label>
                        E-post
                        <input
                            type="email"
                            value={form.email}
                            autoComplete="email"
                            onChange={update("email")}
                            required
                            ref={isRegister ? undefined : firstFieldRef}
                        />
                    </label>

                    <label>
                        Lösenord
                        <input
                            type="password"
                            value={form.password}
                            autoComplete={isRegister ? "new-password" : "current-password"}
                            onChange={update("password")}
                            minLength={isRegister ? 8 : undefined}
                            maxLength={isRegister ? 72 : undefined}
                            aria-describedby={isRegister ? "password-hint" : undefined}
                            required
                        />
                        {isRegister && (
                            <span id="password-hint" className="login-hint">Minst 8 tecken</span>
                        )}
                    </label>

                    {error && <p className="login-error" role="alert">{error}</p>}

                    <button type="submit" disabled={loading}>
                        {submitLabel}
                    </button>
                </form>

                {!notice && (
                    <p className="login-switch">
                        {isRegister ? "Har du redan ett konto?" : "Ny kund?"}{" "}
                        <button
                            type="button"
                            className="link-button"
                            onClick={() => switchMode(isRegister ? "login" : "register")}
                        >
                            {isRegister ? "Logga in" : "Skapa konto"}
                        </button>
                    </p>
                )}
            </div>
        </dialog>
    );
}
