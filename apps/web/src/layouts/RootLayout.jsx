import React from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import { Outlet, ScrollRestoration } from "react-router-dom";
import OfflineWarning from "../components/OfflineWarning.jsx";

export default function RootLayout() {
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <OfflineWarning />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}
