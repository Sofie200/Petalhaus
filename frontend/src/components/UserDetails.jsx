import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import ErrorMessage from "./ErrorMessage";
import Loading from "./Loading";

const UserDetails = () => {

    const API = import.meta.env.VITE_API_URL;
    const token = localStorage.getItem("token");
    const { user } = useAuth();
    const [userInfo, setUserInfo] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function loadUserInfo() {
            try {
                const res = await fetch(`${API}/user/${user.user_id}`, {
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    console.error("Backend error:", data);
                    throw new Error("Kunde inte hämta information om användaren.");
                }

                setUserInfo(data);

            } catch (err) {
                setError(err.message);
                console.log(err.message);
            }
            finally {
                setLoading(false);
            }
        }

        loadUserInfo();

    }, [API, user?.user_id, token]);

    return (
        <div>

            {loading && <Loading />}

            {error && <ErrorMessage message={error} />}

            {!loading && !error && userInfo && (
                <>
                    <h3>Leveransinformation</h3>
                    
                    <p><h5>Namn:</h5> {userInfo[0].first_name} {userInfo[0].last_name}</p>
                    <p><h5>Adress:</h5> {userInfo[0].street}, {userInfo[0].postal_code} {userInfo[0].city}</p>
                    <p><h5>Email:</h5> {userInfo[0].email}</p>
                    <p><h5>Telefon:</h5> {userInfo[0].phone}</p>
                </>
            )}


        </div >
    )
}

export default UserDetails
