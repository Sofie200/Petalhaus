import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleUser } from "@fortawesome/free-solid-svg-icons";
import LoginModal from "./LoginModal";

export default function Login() {

    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Still asking the server who is logged in – show nothing instead of flashing the button
    if (user === undefined) return null;

    if (user) {
        return (
            <span title={`Inloggad som ${user.username}`}>
                <Link to="/profile" aria-label="Mina sidor">
                    <FontAwesomeIcon
                        icon={faCircleUser}
                        className="profile"
                        size="2x"
                    />
                </Link>
            </span>
        );
    }

    return (
        <>
            <button className="login-button" onClick={() => setOpen(true)}>
                Logga in
            </button>
            <LoginModal open={open} onClose={() => setOpen(false)} />
        </>
    );
}
