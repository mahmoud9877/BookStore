import React from "react";
import { Link } from "react-router-dom";
import Logo from "../assets/images/main-logo.png";

export default function Footer() {
  return (
    <>
      <footer id="footer" className="bg-light pt-5">
        <div className="container">
          <div className="row">
            {/* Company Info Section */}
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

            {/* Footer Menus */}
            <div className="col-md-2 mb-4 mb-md-0">
              <div className="footer-menu">
                <h5>About Us</h5>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <Link to="">Vision</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="">Articles</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="">Careers</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="">Service Terms</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="">Donate</Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-2 mb-4 mb-md-0">
              <div className="footer-menu">
                <h5>Discover</h5>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <Link to="/">Home</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="/">Books</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Authors</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Subjects</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Advanced Search</Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-2 mb-4 mb-md-0">
              <div className="footer-menu">
                <h5>My Account</h5>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <Link to="/login">Sign In</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="/cart">View Cart</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">My Wishlist</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Track My Order</Link>
                  </li>
                </ul>
              </div>
            </div>

            <div className="col-md-2">
              <div className="footer-menu">
                <h5>Help</h5>
                <ul className="list-unstyled">
                  <li className="mb-2">
                    <Link to="#">Help Center</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Report a Problem</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Suggesting Edits</Link>
                  </li>
                  <li className="mb-2">
                    <Link to="#">Contact Us</Link>
                  </li>
                </ul>
              </div>
            </div>
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
                <li className="list-inline-item">
                  <a
                    href="https://facebook.com"
                    aria-label="Facebook"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i
                      className="bi bi-facebook"
                      style={{
                        fontSize: "2rem",
                        margin: "10px",
                        color: "white",
                      }}
                    ></i>
                  </a>
                </li>
                <li className="list-inline-item">
                  <a
                    href="http://twitter.com"
                    aria-label="Twitter"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i
                      className="bi bi-twitter"
                      style={{
                        fontSize: "2rem",
                        margin: "10px",
                        color: "white",
                      }}
                    ></i>
                  </a>
                </li>
                <li className="list-inline-item">
                  <a
                    href="http://youtube.com"
                    aria-label="Youtube"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i
                      className="bi bi-youtube"
                      style={{
                        fontSize: "2rem",
                        margin: "10px",
                        color: "white",
                      }}
                    ></i>
                  </a>
                </li>
                <li className="list-inline-item">
                  <a
                    href="http://behance.com"
                    aria-label="Behance"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i
                      className="bi bi-behance"
                      style={{
                        fontSize: "2rem",
                        margin: "10px",
                        color: "white",
                      }}
                    ></i>
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
