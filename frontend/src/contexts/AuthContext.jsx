import { createContext, useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL;
export const AuthContext = createContext();

export function AuthProvider({ children }) {
    // undefined = not checked yet, null = logged out, object = logged in
    const [user, setUser] = useState(undefined);

    const login = (userData) => setUser(userData);

    // Ask the server who is logged in (the cookie is httpOnly, so React can't read it)
    const refresh = useCallback(async () => {
        try {
            const response = await fetch(`${API}/user/me`, { credentials: 'include' });
            setUser(response.ok ? await response.json() : null);
        } catch {
            setUser(null);
        }
    }, []);

    async function logout() {
        try {
            await fetch(`${API}/login/logout`, {
                method: 'POST',
                credentials: 'include',
            });
        } finally {
            setUser(null);
        }
    }

    useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <AuthContext.Provider value={{ user, login, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}