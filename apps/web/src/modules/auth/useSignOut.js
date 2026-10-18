import { useNavigate } from "react-router-dom";
import { useUser } from "./UserContext.jsx";
import { useToast } from "../../components/ui/ToastProvider.jsx";

/** Ends the session, confirms it to the user and returns to the sign-in page. */
export default function useSignOut() {
  const { logout } = useUser();
  const toast = useToast();
  const navigate = useNavigate();

  return () => {
    logout();
    toast.info("You've been signed out.");
    navigate("/login");
  };
}
