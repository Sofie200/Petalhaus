import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function ProtectedRoute({ children, role }) {
    const { user } = useAuth();

    if (!user) return <Navigate to="/" replace />;

    if (role && user.role !== role) {
        return <Navigate to="/unauthorized" replace />;
    }

    return children;
}
