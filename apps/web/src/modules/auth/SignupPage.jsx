import { Helmet } from "react-helmet";
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signup } from "./auth.service.js";
import { signupSchema } from "./auth.validation.js";
import { getErrorMessage } from "../../lib/api-client.js";
import "./SignupPage.css";

const SIGNUP_SUCCESS_NOTICE =
  "Account created. If email confirmation is required, confirm your email before logging in.";

export default function SignupPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState({ userName: "", email: "", password: "", cPassword: "" });

  function handleChange(event) {
    const { name, value } = event.target;
    setUser((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const validation = signupSchema.validate(user, { abortEarly: false });
    if (validation.error) {
      setError(validation.error.details.map((detail) => detail.message).join(", "));
      return;
    }

    setIsLoading(true);
    try {
      await signup(user);
      navigate("/login", { state: { notice: SIGNUP_SUCCESS_NOTICE } });
    } catch (err) {
      setError(getErrorMessage(err, "An error occurred during signup. Please try again."));
      setIsLoading(false);
    }
  }

  return (
    <div>
      <Helmet>
        <title>Signup</title>
      </Helmet>
      {error && <div className="alert alert-danger my-2" role="alert">{error}</div>}

      <div className="d-flex justify-content-center py-1">
        <form className="form" method="post" onSubmit={handleSubmit} noValidate>
          <h3 className="title d-flex justify-content-center">Sign-Up</h3>
          <div className="mb-2">
            <label htmlFor="userName" className="h6 pt-3">Name</label>
            <input
              id="userName"
              type="text"
              className="form-control pt-2"
              placeholder="Your Name"
              name="userName"
              autoComplete="name"
              onChange={handleChange}
            />
          </div>
          <div className="mb-2">
            <label htmlFor="email" className="h6">Email</label>
            <input
              id="email"
              placeholder="Your Email"
              className="form-control"
              type="email"
              name="email"
              autoComplete="email"
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-2">
            <label htmlFor="password" className="h6">Password</label>
            <input
              id="password"
              placeholder="Password"
              className="form-control"
              type="password"
              name="password"
              autoComplete="new-password"
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-2">
            <label htmlFor="cPassword" className="h6">Confirm Password</label>
            <input
              id="cPassword"
              placeholder="Confirm Password"
              className="form-control"
              type="password"
              name="cPassword"
              autoComplete="new-password"
              onChange={handleChange}
              required
            />
          </div>
          <div className="button d-flex justify-content-center">
            <button
              className="btn btn-outline-secondary py-2 w-50 bg-black"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              ) : (
                "Sign Up"
              )}
            </button>
          </div>
          <p className="pt-4">
            Already have an account? <Link to="/login">Log-In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
