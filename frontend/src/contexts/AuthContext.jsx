import { createContext, useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL;
export const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined);

    const login = (userData) => setUser(userData);

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

        async function getMe() { 
            
            try {
                const response = await fetch(`${API}/user/me`, {
                    credentials: 'include',
                })

                if (response.ok){
                    setUser(await response.json());
                }else{
                    setUser(null);
                }

            } catch {
                setUser(null);
            }
        };

        getMe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}