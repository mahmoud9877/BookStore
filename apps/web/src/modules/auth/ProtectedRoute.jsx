import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "./UserContext.jsx";

/** Renders children for signed-in users (optionally with a given role). */
export default function ProtectedRoute({ children, role }) {
  const { userData } = useUser();
  const location = useLocation();

  if (!userData) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (role && userData.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
