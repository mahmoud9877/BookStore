import React from "react";
import Header from "../Header/Header.jsx";
import Footer from "../Footer/Footer.jsx";
import { Outlet, useNavigate } from "react-router-dom";

export default function RootLayout({ userData, setUserData }) {
  let navigate = useNavigate();
  function logout() {
    localStorage.removeItem("userToken");
    setUserData(null);
    navigate("/login");
  }
  return (
    <>
      <Header logout={logout} userData={userData} />
      <Outlet></Outlet>
      <Footer />
    </>
  );
}
