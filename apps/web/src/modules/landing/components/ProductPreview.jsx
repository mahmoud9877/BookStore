import React from "react";
import { msg, t, tp } from "../../../i18n/index.js";
import { formatNumber } from "../../../lib/format.js";

// Illustrative values only — this is a drawing of the interface, not live data.
// Book titles are sample catalogue data and stay as they are.
const KPIS = [
  { label: msg("Titles"), value: 12480 },
  { label: msg("On loan"), value: 1326, overdue: 48 },
  { label: msg("Active members"), value: 3915 },
  { label: msg("Reservations"), value: 212 },
];

const ACTIVITY = [
  { book: "The Name of the Rose", who: "M-0004182", action: msg("Returned"), status: msg("Shelved"), tone: "success" },
  { book: "A Brief History of Time", who: "M-0001057", action: msg("Checked out"), status: msg("Due in 14 days"), tone: "primary" },
  { book: "Pride and Prejudice", who: "M-0002230", action: msg("Reserved"), status: msg("Ready for pickup"), tone: "info" },
  { book: "The Selfish Gene", who: "M-0000918", action: msg("Overdue"), status: msg("6 days late"), tone: "danger" },
];

const NAV = [msg("Overview"), msg("Circulation desk"), msg("Loans"), msg("Reservations"), msg("Members"), msg("Copies"), msg("Reports")];

/**
 * A faithful, simplified drawing of the staff workspace for the landing page.
 * Built in HTML/CSS (sharp at any size, no image weight, no layout shift) and
 * clearly labelled as sample data.
 */
export default function ProductPreview({ variant = "dashboard" }) {
  return (
    <figure className="preview" aria-label={t("Illustration of the BookSaw staff workspace with sample data")}>
      <div className="preview-window" aria-hidden="true">
        <div className="preview-chrome">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="preview-body">
          <div className="preview-sidebar">
            <div className="preview-brand">BookSaw</div>
            {NAV.map((item, index) => (
              <div key={item} className={`preview-nav ${index === (variant === "desk" ? 1 : 0) ? "active" : ""}`}>
                {t(item)}
              </div>
            ))}
          </div>
          <div className="preview-main">
            {variant === "desk" ? (
              <div className="preview-desk">
                <div className="preview-panel">
                  <div className="preview-panel-title">{t("Check out")}</div>
                  <div className="preview-field ltr">M-0004182</div>
                  <div className="preview-member">
                    <strong>{t("Layla Mansour")}</strong>
                    <span>{t("Student · 2 of 8 loans · no fines")}</span>
                  </div>
                  <div className="preview-field ltr">MAIN-0001874</div>
                  <div className="preview-button">{t("Check out")}</div>
                  <div className="preview-success">{t("Due 6 Nov · held reservation fulfilled")}</div>
                </div>
                <div className="preview-panel">
                  <div className="preview-panel-title">{t("Return")}</div>
                  <div className="preview-field ltr">EAST-0000932</div>
                  <div className="preview-button secondary">{t("Return")}</div>
                  <div className="preview-note">{t("Held for the next reader at Main Library")}</div>
                </div>
              </div>
            ) : (
              <>
                <div className="preview-title">{t("Good morning")}</div>
                <div className="preview-kpis">
                  {KPIS.map((kpi) => (
                    <div key={kpi.label} className="preview-kpi">
                      <span className="preview-kpi-label">{t(kpi.label)}</span>
                      <span className="preview-kpi-value">{formatNumber(kpi.value)}</span>
                      {kpi.overdue && <span className="preview-kpi-note">{tp("overdue", kpi.overdue)}</span>}
                    </div>
                  ))}
                </div>
                <div className="preview-table">
                  <div className="preview-table-head">{t("Recent circulation")}</div>
                  {ACTIVITY.map((row) => (
                    <div key={row.book} className="preview-row">
                      <span className="preview-row-title">{row.book}</span>
                      <span className="preview-row-who ltr">{row.who}</span>
                      <span className="preview-row-action">{t(row.action)}</span>
                      <span className={`preview-pill tone-${row.tone}`}>{t(row.status)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <figcaption className="preview-caption">
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
        {t("Illustration with sample data — not live figures.")}
      </figcaption>
    </figure>
  );
}
