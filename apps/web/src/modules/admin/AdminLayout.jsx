import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { ADMIN_GROUPS } from "./admin-sections.js";
import { usePermissions } from "../auth/auth.queries.js";

/** Shell for /dashboard: a grouped sidebar (a scrolling strip on small screens) beside the section. */
export default function AdminLayout() {
  const { can } = usePermissions();
  const groups = ADMIN_GROUPS.map((group) => ({ ...group, sections: group.sections.filter((section) => can(...section.permissions)) })).filter(
    (group) => group.sections.length
  );

  return (
    <div className="container">
      <div className="admin-shell">
        <nav className="admin-sidebar" aria-label="Administration">
          <NavLink to="/dashboard" end>
            <i className="bi bi-speedometer2" aria-hidden="true"></i>Overview
          </NavLink>
          {groups.map((group) => (
            <React.Fragment key={group.label}>
              <div className="group-label">{group.label}</div>
              {group.sections.map(({ path, label, icon }) => (
                <NavLink key={path} to={path}>
                  <i className={`bi bi-${icon}`} aria-hidden="true"></i>
                  {label}
                </NavLink>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="min-w-0 pb-5">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
