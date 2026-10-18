import React, { useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes.jsx";
import Toaster from "../components/ui/Toaster.jsx";
import useCartSync from "../modules/cart/useCartSync.js";
import ConfirmDialog from "../components/ui/ConfirmDialog.jsx";

// Global state lives in Zustand stores (auth, cart, toasts, confirm); no providers needed.
// Hash routing keeps deep links working on static hosts (GitHub Pages, nginx).
export default function App({ createRouter = createHashRouter }) {
  const [router] = useState(() => createRouter(routes));
  useCartSync();

  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
      <ConfirmDialog />
    </>
  );
}
