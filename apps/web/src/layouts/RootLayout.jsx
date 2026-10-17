import React from "react";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import { Outlet, useNavigate } from "react-router-dom";
import { useUser } from "../modules/auth/UserContext.jsx";

export default function RootLayout() {
  const navigate = useNavigate();
  const { userData, logout } = useUser();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <Header userData={userData} onLogout={handleLogout} />
      <main>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
