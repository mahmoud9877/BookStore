import React from "react";
import ReactDOM from "react-dom/client";
// Bootstrap is linked in public/index.html (LTR or RTL build, chosen by language).
import "./i18n/language.store.js";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/theme.css";
import App from "./app/App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
