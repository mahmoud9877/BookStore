import { Navigate, useLocation } from "react-router-dom";
import { selectUser, useAuthStore } from "./auth.store.js";

/** Renders children for signed-in users (optionally with a given role). */
export default function ProtectedRoute({ children, role }) {
  const user = useAuthStore(selectUser);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
