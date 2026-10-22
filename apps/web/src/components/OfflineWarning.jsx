import React from "react";
import { Offline } from "react-detect-offline";
import { t } from "../i18n/index.js";

export default function OfflineWarning() {
  return (
    <Offline>
      <div className="offline-banner text-center py-2 px-3" role="status">
        <i className="bi bi-wifi-off me-2" aria-hidden="true"></i>
        {t("You're offline. Some actions won't work until your connection is back.")}
      </div>
    </Offline>
  );
}
