import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const Nav = () => {

    const { user } = useAuth();

    return (
        <div>
            {user?.role === "admin" && (
                <nav>
                    <Link to="/admin/add-product">Lägg till produkt</Link>
                    &nbsp;|&nbsp;
                    <Link to="/admin/manage-orders">Orderhantering</Link>
                </nav>
            )}
        </div>
    )
}

export default Nav
