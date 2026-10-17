import React from "react";
import { Offline } from "react-detect-offline";

export default function OfflineWarning() {
  return (
    <div>
      <Offline>
        <div className="offline-warning">
          <p>
            You are currently offline. Please check your internet connection.
          </p>
        </div>
      </Offline>
    </div>
  );
}

