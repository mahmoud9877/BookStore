import React from "react";
import { Link } from "react-router-dom";
import Logo from "../assets/images/main-logo.png";

const MENUS = [
  {
    title: "About Us",
    links: [
      { label: "Vision", to: "" },
      { label: "Articles", to: "" },
      { label: "Careers", to: "" },
      { label: "Service Terms", to: "" },
      { label: "Donate", to: "" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "Home", to: "/" },
      { label: "Books", to: "/" },
      { label: "Authors", to: "#" },
      { label: "Subjects", to: "#" },
      { label: "Advanced Search", to: "#" },
    ],
  },
  {
    title: "My Account",
    links: [
      { label: "Sign In", to: "/login" },
      { label: "View Cart", to: "/cart" },
      { label: "My Wishlist", to: "#" },
      { label: "Track My Order", to: "#" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Help Center", to: "#" },
      { label: "Report a Problem", to: "#" },
      { label: "Suggesting Edits", to: "#" },
      { label: "Contact Us", to: "#" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "Facebook", icon: "facebook", href: "https://facebook.com" },
  { label: "Twitter", icon: "twitter", href: "http://twitter.com" },
  { label: "Youtube", icon: "youtube", href: "http://youtube.com" },
  { label: "Behance", icon: "behance", href: "http://behance.com" },
];

const SOCIAL_ICON_STYLE = { fontSize: "2rem", margin: "10px", color: "white" };

function FooterMenu({ title, links, className }) {
  return (
    <div className={className}>
      <div className="footer-menu">
        <h5>{title}</h5>
        <ul className="list-unstyled">
          {links.map(({ label, to }) => (
            <li key={label} className="mb-2">
              <Link to={to}>{label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Footer() {
  return (
    <>
      <footer id="footer" className="bg-light pt-5">
        <div className="container">
          <div className="row">
            <div className="col-md-4 mb-4 mb-md-0">
              <div className="footer-item">
                <div className="company-brand">
                  <img src={Logo} alt="BookSaw" className="footer-logo mb-3" />
                  <p>
                    Lorem ipsum dolor sit amet, consectetur advising elit.
                    Sagittis sed ptibus libero lectus nonet psryroin. Amet sed
                    lorem posuere sit iaculis amet, ac urna. Adipiscing fames
                    semper erat ac in suspendisse iaculis.
                  </p>
                </div>
              </div>
            </div>

            {MENUS.map((menu, index) => (
              <FooterMenu
                key={menu.title}
                {...menu}
                className={index === MENUS.length - 1 ? "col-md-2" : "col-md-2 mb-4 mb-md-0"}
              />
            ))}
          </div>
        </div>
      </footer>

      <div id="footer-bottom" className="bg-dark ">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-md-6 text-center text-md-start text-white mb-3 mb-md-0">
              <p className="mb-0">
                © 2022 All rights reserved. Free HTML Template by{" "}
                <a
                  href="https://www.templatesjungle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white text-decoration-underline"
                >
                  TemplatesJungle
                </a>
              </p>
            </div>

            <div className="col-md-6 text-center text-md-end">
              <ul className="list-inline mb-0">
                {SOCIAL_LINKS.map(({ label, icon, href }) => (
                  <li key={label} className="list-inline-item">
                    <a href={href} aria-label={label} target="_blank" rel="noopener noreferrer">
                      <i className={`bi bi-${icon}`} aria-hidden="true" style={SOCIAL_ICON_STYLE}></i>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
