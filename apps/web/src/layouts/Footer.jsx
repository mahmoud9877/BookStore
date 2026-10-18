import React from "react";
import { Link } from "react-router-dom";
import Logo from "../assets/images/main-logo.png";

const LINKS = [
  { label: "Browse books", to: "/" },
  { label: "Your cart", to: "/cart" },
  { label: "Your account", to: "/profile" },
];

export default function Footer() {
  return (
    <footer className="site-footer mt-5">
      <div className="container py-4">
        <div className="d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
          <div>
            <img src={Logo} alt="BookSaw" className="brand-logo mb-2" />
            <p className="mb-0">Books worth reading, delivered to your door.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="list-inline mb-0">
              {LINKS.map(({ label, to }) => (
                <li key={to} className="list-inline-item me-3">
                  <Link to={to}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <hr className="my-3" />
        <p className="small mb-0">
          © {new Date().getFullYear()} BookSaw · Design based on a template by{" "}
          <a href="https://www.templatesjungle.com/" target="_blank" rel="noopener noreferrer">
            TemplatesJungle
          </a>
        </p>
      </div>
    </footer>
  );
}
