import React from "react";
import { Offline } from "react-detect-offline";

export default function OfflineWarning() {
  return (
    <Offline>
      <div className="offline-banner text-center py-2 px-3" role="status">
        <i className="bi bi-wifi-off me-2" aria-hidden="true"></i>
        You're offline. Some actions won't work until your connection is back.
      </div>
    </Offline>
  );
}
