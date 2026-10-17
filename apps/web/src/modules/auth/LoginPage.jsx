import { Helmet } from "react-helmet";
import React, { useState } from "react";
import useForm from "../../hooks/useForm.js";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "./auth.service.js";
import { useUser } from "./UserContext.jsx";
import { loginSchema } from "./auth.validation.js";
import { getErrorMessage } from "../../lib/api-client.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: startSession } = useUser();
  const [errorList, setErrorList] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { values: credentials, handleChange: updateField } = useForm({ email: "", password: "" });
  const notice = location.state?.notice;

  function handleChange(event) {
    updateField(event);
    setError("");
    setErrorList([]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validation = loginSchema.validate(credentials, { abortEarly: false });
    if (validation.error) {
      setErrorList(validation.error.details);
      return;
    }

    setIsLoading(true);
    try {
      const data = await login(credentials);
      startSession(data.token);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) {
      const message = getErrorMessage(err, "An error occurred during login. Please try again.");
      setError(message === "Wrong Password" ? "Wrong password or email" : message);
      setIsLoading(false);
    }
  }

  return (
    <div className="d-flex justify-content-center py-4">
      <Helmet>
        <title>Login</title>
      </Helmet>
      <form className="form" onSubmit={handleSubmit} noValidate>
        <p className="title">Log-In</p>

        {notice && <div className="alert alert-success">{notice}</div>}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {errorList.map((err) => (
          <div key={err.path.join(".")} className="alert alert-danger" role="alert">
            {err.message}
          </div>
        ))}

        <div className="mb-2">
          <label htmlFor="login-email" className="h6 pt-3">Email</label>
          <input
            id="login-email"
            type="email"
            className="form-control pt-2"
            placeholder="Your Email"
            name="email"
            autoComplete="email"
            onChange={handleChange}
          />
        </div>
        <div className="mb-2">
          <label htmlFor="login-password" className="h6 pt-3">Password</label>
          <input
            id="login-password"
            type="password"
            className="form-control pt-2"
            placeholder="Your Password"
            name="password"
            autoComplete="current-password"
            onChange={handleChange}
          />
        </div>
        <button className="btn py-2 w-75 bg-black" type="submit" disabled={isLoading}>
          {isLoading ? (
            <span className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </span>
          ) : (
            "Login"
          )}
        </button>
        <p>
          Don't have an account? <Link to="/signup">Sign-Up</Link>
        </p>
      </form>
    </div>
  );
}
