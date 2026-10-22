import { ADMIN_SECTIONS } from "./admin-sections.js";
import { usePermissions } from "../auth/auth.queries.js";

/** The dashboard sections the signed-in user may open (none for customers). */
export function useAdminSections() {
  const { can } = usePermissions();
  return ADMIN_SECTIONS.filter((section) => can(...section.permissions));
}
