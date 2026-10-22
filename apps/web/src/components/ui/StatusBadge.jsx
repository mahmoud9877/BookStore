import React from "react";
import { humanize } from "../../lib/format.js";

// Tone per status value, across copies, loans, reservations, fines, payments, orders…
const TONES = {
  available: "success", active: "success", ready: "success", paid: "success", succeeded: "success", received: "success", confirmed: "success", sent: "success", scheduled: "success", fulfilled: "success",
  on_loan: "primary", in_transit: "info", on_hold: "info", waiting: "info", requested: "info", approved: "info", ordered: "info", partially_received: "info", pending: "info", open: "info", partially_refunded: "warning",
  overdue: "danger", damaged: "warning", missing: "warning", suspended: "warning", outstanding: "warning", expired: "secondary",
  lost: "danger", failed: "danger", rejected: "danger", cancelled: "secondary", withdrawn: "secondary", returned: "secondary", closed: "secondary", refunded: "secondary", waived: "secondary", skipped: "secondary",
};

/** A coloured, human-readable status pill. */
export default function StatusBadge({ status, label }) {
  const tone = TONES[status] ?? "secondary";
  return <span className={`badge status-badge status-${tone}`}>{label ?? humanize(status)}</span>;
}
