import { useAuth } from '../hooks/useAuth';

const Profile = () => {

    const { user, logout } = useAuth();

    function handleLogout() {
        logout();
    }

    return (
        <div>
            <h2>Din Profil</h2>

            <p>
                Användarnamn: {user?.username && user.username}
            </p>

            {user &&
                <a onClick={handleLogout} style={{ cursor: "pointer" }}>Logga ut</a>
            }
        </div>
    )
}

export default Profile
