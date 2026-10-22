import React from "react";
import { useActiveBranches } from "../branches/branch.queries.js";
import { t } from "../../i18n/index.js";

/** A labelled branch filter/select ("" = all branches). */
export default function BranchSelect({ id, label = t("Branch"), value, onChange, allLabel = t("All branches"), className = "" }) {
  const { data: branches } = useActiveBranches();
  return (
    <div className={className}>
      <label htmlFor={id} className="form-label small mb-1">
        {label}
      </label>
      <select id={id} className="form-select form-select-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {allLabel !== null && <option value="">{allLabel}</option>}
        {branches.map((branch) => (
          <option key={branch._id} value={branch._id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}
