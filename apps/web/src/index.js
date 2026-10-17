import ReactDOM from "react-dom/client"; // Correctly importing from the latest React version
import React from "react";
import "bootstrap/dist/css/bootstrap.min.css"; // Import Bootstrap CSS
import "bootstrap/dist/js/bootstrap.bundle.min"; // Optional: Bootstrap JS
import "bootstrap-icons/font/bootstrap-icons.css";
import App from "./Components/App/App.jsx";
import "./css/normalize.module.css";
import "./css/vendor.css";
import { UserProvider } from "./Context/UserContext.jsx";

export const baseURL = `https://book-store-liart-zeta.vercel.app`;
export const bearerKey = `Hamada__`;

const root = ReactDOM.createRoot(document.getElementById("root"));

// Wrap the App component with UserProvider
root.render(
  <UserProvider>
    <App />
  </UserProvider>
);
