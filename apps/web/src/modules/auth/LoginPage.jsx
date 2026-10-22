import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthCard from "./AuthCard.jsx";
import { login } from "./auth.service.js";
import { useAuthStore } from "./auth.store.js";
import { loginSchema } from "./auth.validation.js";
import useForm from "../../hooks/useForm.js";
import Spinner from "../../components/ui/Spinner.jsx";
import { getErrorMessage } from "../../lib/api-client.js";
import FormField, { PasswordField } from "../../components/ui/FormField.jsx";

// Both "unknown email" and "wrong password" read the same, so the form doesn't reveal which accounts exist.
const FRIENDLY_ERRORS = {
  "Wrong Password": "That email and password don't match.",
  "Email Not found": "That email and password don't match.",
  "Confirm Your Email": "Please confirm your email address first — check your inbox for the link.",
};

const toFriendlyError = (err) => {
  const message = getErrorMessage(err, "We couldn't sign you in. Please try again.");
  return FRIENDLY_ERRORS[message] ?? message;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const startSession = useAuthStore((state) => state.signIn);
  const { field, formError, isSubmitting, handleSubmit } = useForm(
    { email: "", password: "" },
    { schema: loginSchema, errorMessage: toFriendlyError }
  );

  async function signIn(credentials) {
    const { token, role } = await login(credentials);
    startSession(token);
    // Back to where they were going; otherwise members to their library, staff to the workspace.
    navigate(location.state?.from || (role && role !== "User" ? "/dashboard" : "/account"), { replace: true });
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back to BookSaw."
      error={formError}
      footer={
        <>
          New to BookSaw? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      {location.state?.notice && <div className="alert alert-info small">{location.state.notice}</div>}
      <form onSubmit={handleSubmit(signIn)} noValidate>
        <FormField label="Email" type="email" autoComplete="email" autoFocus {...field("email")} />
        <PasswordField label="Password" autoComplete="current-password" {...field("password")} />
        <button className="btn btn-primary w-100 py-2" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label="Signing in" /> : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
