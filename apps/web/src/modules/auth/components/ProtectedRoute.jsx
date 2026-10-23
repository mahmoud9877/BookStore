import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "../queries/auth.queries.js";
import { selectUser, useAuthStore } from "../stores/auth.store.js";
import { t } from "../../../i18n/index.js";

/**
 * Renders children for signed-in users. With `permissions`, the user's role
 * must grant at least one of them.
 */
export default function ProtectedRoute({ children, permissions }) {
  const user = useAuthStore(selectUser);
  const location = useLocation();
  const { can, isLoading } = usePermissions();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (permissions) {
    if (isLoading) {
      return (
        <p className="container text-muted" aria-busy="true">
          {t("Checking your access…")}
        </p>
      );
    }
    if (!can(...permissions)) return <Navigate to="/catalog" replace />;
  }
  return children;
}
