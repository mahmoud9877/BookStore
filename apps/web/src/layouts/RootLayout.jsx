import React, { Suspense, useRef } from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import { Outlet, ScrollRestoration } from "react-router-dom";
import OfflineWarning from "../components/OfflineWarning.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import { t } from "../i18n/index.js";

/** Layout of the public catalogue, the member portal and the auth pages. */
export default function RootLayout() {
  const mainRef = useRef(null);
  return (
    <>
      {/* Hash routing owns the URL hash, so the skip link moves focus itself. */}
      <a href="#main-content" className="skip-link" onClick={(event) => { event.preventDefault(); mainRef.current?.focus(); }}>
        {t("Skip to content")}
      </a>
      <OfflineWarning />
      <Header />
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  );
}
