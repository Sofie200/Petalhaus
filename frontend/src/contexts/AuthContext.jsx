import { createContext, useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined);

    const login = (token) => {
        localStorage.setItem("token", token);

        const decoded = jwtDecode(token);
        console.log(decoded);
        setUser({
            user_id: decoded.user_id,
            username: decoded.username,
            role: decoded.role
        });
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("token");
    };

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const decoded = jwtDecode(token);

            // Token expired
            if (decoded.exp * 1000 < Date.now()) {
                logout();
                return;
            }

            // Token valid
            setUser({
                user_id: decoded.user_id,
                username: decoded.username,
                role: decoded.role
            });

        } catch {
            logout();
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}