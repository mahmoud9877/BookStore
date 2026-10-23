import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./auth.store.js";
import { toast } from "../../components/ui/toast.store.js";
import { t } from "../../i18n/index.js";

/** Ends the session, confirms it to the user and returns to the sign-in page. */
export default function useSignOut() {
  const signOut = useAuthStore((state) => state.signOut);
  const navigate = useNavigate();

  return () => {
    signOut();
    toast.info(t("You've been signed out."));
    navigate("/login");
  };
}
