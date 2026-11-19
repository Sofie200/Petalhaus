import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleUser } from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import LoginModal from "./LoginModal";

export default function Login() {

    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Still asking the server who is logged in – show nothing instead of flashing the button
    if (user === undefined) return null;

    // Logged in with GitHub → show it clearly, with the GitHub username
    if (user?.hasGithub) {
        return (
            <Link
                to="/profile"
                className="auth-chip auth-chip--github"
                title={`Inloggad med GitHub som ${user.username}`}
                aria-label={`Mina sidor – inloggad med GitHub som ${user.username}`}
            >
                <FontAwesomeIcon icon={faGithub} className="auth-chip-icon" />
                <span className="auth-chip-name">{user.username}</span>
                {user.role === "admin" && <span className="auth-chip-role">Admin</span>}
            </Link>
        );
    }

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
