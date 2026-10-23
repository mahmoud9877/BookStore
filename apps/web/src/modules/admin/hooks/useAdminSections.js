import { ADMIN_SECTIONS } from "../constants/admin-sections.js";
import { usePermissions } from "../../auth/queries/auth.queries.js";

/** The dashboard sections the signed-in user may open (none for customers). */
export function useAdminSections() {
  const { can } = usePermissions();
  return ADMIN_SECTIONS.filter((section) => can(...section.permissions));
}
