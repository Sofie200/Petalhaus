import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faLock } from "@fortawesome/free-solid-svg-icons";
import LoginModal from "./LoginModal";

// The server sends the user back with ?authError=<code> – Google and GitHub use the same codes.
// retry: true → the user can fix it by trying again, so we offer "Försök igen".
const MESSAGES = {
    cancelled: {
        title: "Inloggningen avbröts",
        text: "Du avbröt inloggningen och är inte inloggad.",
        retry: true,
    },
    invalid_state: {
        title: "Inloggningen gick ut",
        text: "Inloggningen kunde inte verifieras, den kan ha tagit för lång tid. Försök igen.",
        retry: true,
    },
    google_error: {
        title: "Kunde inte logga in med Google",
        text: "Google kunde inte logga in dig just nu. Försök igen om en stund.",
        retry: true,
    },
    invalid_token: {
        title: "Kunde inte verifiera kontot",
        text: "Vi kunde inte verifiera ditt Google-konto. Försök igen.",
        retry: true,
    },
    github_error: {
        title: "Kunde inte logga in med GitHub",
        text: "GitHub kunde inte logga in dig just nu. Försök igen om en stund.",
        retry: true,
    },
    github_not_admin: {
        title: "Ingen behörighet",
        text: "Ditt GitHub-konto har inte behörighet till adminsidan. Kontakta butikens ansvariga om du ska vara admin.",
        icon: faLock,
    },
    google_in_use: {
        title: "Kontot används redan",
        text: "Det här Google-kontot är redan kopplat till ett annat konto.",
    },
    not_logged_in: {
        title: "Du är inte inloggad",
        text: "Du måste vara inloggad för att koppla ett Google-konto.",
        retry: true,
    },
    server_error: {
        title: "Något gick fel",
        text: "Något gick fel hos oss. Försök igen om en stund.",
        retry: true,
    },
    email_taken: {
        text: "Det finns redan ett konto med den här e-postadressen. Logga in med e-post och lösenord nedan, och koppla sedan Google under Mina sidor.",
    },
};

const FALLBACK = { title: "Inloggningen misslyckades", text: "Något gick fel vid inloggningen. Försök igen.", retry: true };

export default function AuthError() {
    const [searchParams, setSearchParams] = useSearchParams();
    const code = searchParams.get("authError");
    const dialogRef = useRef(null);
    const [retrying, setRetrying] = useState(false);

    // Open the native <dialog> as a modal when there is an error in the URL
    useEffect(() => {
        const dialog = dialogRef.current;
        if (code && dialog && !dialog.open) dialog.showModal();
    }, [code]);

    // Remove ?authError from the URL, so the message doesn't come back on reload
    function clearCode() {
        const next = new URLSearchParams(searchParams);
        next.delete("authError");
        setSearchParams(next, { replace: true });
    }

    function retry() {
        setRetrying(true);
        dialogRef.current?.close(); // → onClose → clearCode
    }

    // "Försök igen" → the normal login modal
    if (retrying) {
        return <LoginModal open onClose={() => setRetrying(false)} />;
    }

    if (!code) return null;

    // The customer can fix this one right away – show the password login directly
    if (code === "email_taken") {
        return <LoginModal open onClose={clearCode} notice={MESSAGES.email_taken.text} />;
    }

    const message = MESSAGES[code] ?? FALLBACK;

    return (
        <dialog
            ref={dialogRef}
            className="login-modal auth-error-modal"
            role="alertdialog"
            aria-labelledby="auth-error-title"
            aria-describedby="auth-error-text"
            onClose={clearCode}
            onClick={(e) => e.target === dialogRef.current && dialogRef.current.close()}
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

                <div className="auth-error-icon" aria-hidden="true">
                    <FontAwesomeIcon icon={message.icon ?? faCircleExclamation} />
                </div>

                <h2 id="auth-error-title">{message.title}</h2>
                <p id="auth-error-text" className="auth-error-text">{message.text}</p>

                <div className="auth-error-actions">
                    {message.retry && (
                        <button type="button" onClick={retry}>
                            Försök igen
                        </button>
                    )}
                    <button
                        type="button"
                        className={message.retry ? "btn-outline" : undefined}
                        onClick={() => dialogRef.current?.close()}
                    >
                        Stäng
                    </button>
                </div>
            </div>
        </dialog>
    );
}
