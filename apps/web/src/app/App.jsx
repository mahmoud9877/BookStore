import React, { useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes.jsx";
import OfflineWarning from "../components/OfflineWarning.jsx";
import { UserProvider } from "../modules/auth/UserContext.jsx";

// Hash routing keeps deep links working on static hosts (GitHub Pages, nginx).
export default function App({ createRouter = createHashRouter }) {
  const [router] = useState(() => createRouter(routes));

  return (
    <UserProvider>
      <OfflineWarning />
      <RouterProvider router={router} />
    </UserProvider>
  );
}
