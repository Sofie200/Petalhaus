import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleUser } from "@fortawesome/free-solid-svg-icons";

const API = import.meta.env.VITE_API_URL;

export default function Login() {

    const { user, login } = useAuth();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(e) {

        e.preventDefault();
        setError("");

        try {

            const res = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || "Fel användarnamn eller lösenord");
                return;
            }

            login(data.token);

            localStorage.setItem("token", data.token);

            setUsername("");
            setPassword("");

        } catch (err) {
            setError("Något gick fel: " + err);
        }
    }

    return (
        <>

            {user

                ? <span title={`Inloggad som ${user.username}`}>
                    <Link to="/profile">
                        <FontAwesomeIcon
                            icon={faCircleUser}
                            className="profile"
                            size="2x"
                        />
                    </Link>
                </span>
                : <div className="login-container">

                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            placeholder="Användarnamn"
                            value={username}
                            autoComplete="username"
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />

                        <input
                            type="password"
                            placeholder="Lösenord"
                            value={password}
                            autoComplete="current-password"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />

                        {error && <p className="error">{error}</p>}

                        <button type="submit">Logga in</button>

                    </form>
                </div>
            }
        </>
    )
}