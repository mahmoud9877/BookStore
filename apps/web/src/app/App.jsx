import React, { useState } from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes.jsx";
import { CartProvider } from "../modules/cart/CartContext.jsx";
import { UserProvider } from "../modules/auth/UserContext.jsx";
import { ToastProvider } from "../components/ui/ToastProvider.jsx";
import { ConfirmProvider } from "../components/ui/ConfirmProvider.jsx";

// Hash routing keeps deep links working on static hosts (GitHub Pages, nginx).
export default function App({ createRouter = createHashRouter }) {
  const [router] = useState(() => createRouter(routes));

  return (
    <UserProvider>
      <CartProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RouterProvider router={router} />
          </ConfirmProvider>
        </ToastProvider>
      </CartProvider>
    </UserProvider>
  );
}
