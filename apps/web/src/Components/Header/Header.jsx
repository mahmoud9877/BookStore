import React from "react";
import { Link } from "react-router-dom";
import Logo from "../../images/main-logo.png";
import "./Header.css";

const Header = ({ userData, logout }) => {
  console.log({ userData }); // التحقق من البيانات في الكونسول

  return (
    <header id="header-wrap" className="bg-light py-3 border-bottom vh-20">
      <div className="top-content">
        <div className="container-fluid">
          <div className="row justify-content-between align-items-center">
            {/* Left Column - Logo */}
            <div className="col-12 col-md-6 d-flex align-items-center justify-content-center justify-content-md-start">
              <div className="container-fluid">
                <div className="row align-items-center">
                  <div className="col-6 col-md-2">
                    <div className="main-logo">
                      <Link to="/">
                        <img src={Logo} alt="logo" className="img-fluid" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - User Account, Cart, and Logout */}
            <div className="col-12 col-md-6 d-flex justify-content-center justify-content-md-end align-items-center mt-3 mt-md-0">
              <div className="right-element d-flex align-items-center">
                {userData ? (
                  <>
                    {/* الحساب الشخصي */}
                    <Link to="/profile" className="user-account me-3">
                      <i className="bi bi-person-circle fs-5"></i>
                      <span className="ms-2">{userData.userName}</span>
                    </Link>

                    {/* سلة المشتريات */}
                    <Link to="/cart" className="cart me-3">
                      <i className="bi bi-cart fs-5"></i>
                      <span className="ms-2">{userData?.cart ?? 0}</span>
                    </Link>

                    {/* زر تسجيل الخروج */}
                    <button onClick={logout} className="btn btn-link text-dark">
                      <i className="bi bi-box-arrow-right fs-5"></i>
                      <span className="ms-1">Logout</span>
                    </button>
                  </>
                ) : (
                  <Link to="/signup" className="user-account">
                    <i className="bi bi-person-circle fs-5"></i>
                    <span className="ms-2">Signup</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
