import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Loading from "../Loading";

export default function ProtectedRoute({ children, role }) {
    const { user } = useAuth();

    if (user === undefined) return <Loading />;   // still asking the server
    if (!user) return <Navigate to="/" replace />;

    if (role && user.role !== role) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
}