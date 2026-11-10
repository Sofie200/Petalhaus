import { useSearchParams } from "react-router-dom";
import ErrorMessage from "./ErrorMessage";
import LoginModal from "./LoginModal";

const MESSAGES = {
    cancelled: "Inloggningen avbröts. Du är inte inloggad.",
    google_error: "Google kunde inte logga in dig just nu. Försök igen.",
    invalid_state: "Inloggningen kunde inte verifieras, den kan ha tagit för lång tid. Försök igen.",
    invalid_token: "Vi kunde inte verifiera ditt Google-konto. Försök igen.",
    email_taken: "Det finns redan ett konto med den här e-postadressen. Logga in med e-post och lösenord nedan, och koppla sedan Google under Mina sidor.",
    google_in_use: "Det här Google-kontot är redan kopplat till ett annat konto.",
    not_logged_in: "Du måste vara inloggad för att koppla ett Google-konto.",
    server_error: "Något gick fel hos oss. Försök igen om en stund.",
};

export default function AuthError() {
    const [searchParams, setSearchParams] = useSearchParams();
    const code = searchParams.get("authError");

    if (!code) return null;

    function close() {
        const next = new URLSearchParams(searchParams);
        next.delete("authError");
        setSearchParams(next, { replace: true });
    }

    // The customer can fix this one right away – show the password login in a modal
    if (code === "email_taken") {
        return <LoginModal open onClose={close} notice={MESSAGES.email_taken} />;
    }

    return (
        <div className="auth-error" role="alert">
            <ErrorMessage message={MESSAGES[code] ?? "Inloggningen misslyckades. Försök igen."} />
            <button onClick={close} aria-label="Stäng">×</button>
        </div>
    );
}