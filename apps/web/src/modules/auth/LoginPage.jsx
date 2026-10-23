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
import { msg, t } from "../../i18n/index.js";

// Both "unknown email" and "wrong password" read the same, so the form doesn't reveal which accounts exist.
const FRIENDLY_ERRORS = {
  "Wrong Password": msg("That email and password don't match."),
  "Email Not found": msg("That email and password don't match."),
  "Confirm Your Email": msg("Please confirm your email address first — check your inbox for the link."),
};

const toFriendlyError = (err) => {
  const message = getErrorMessage(err, t("We couldn't sign you in. Please try again."));
  return FRIENDLY_ERRORS[message] ? t(FRIENDLY_ERRORS[message]) : message;
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
      title={t("Sign in")}
      subtitle={t("Welcome back to BookSaw.")}
      error={formError}
      footer={
        <>
          {t("New to BookSaw?")} <Link to="/signup">{t("Create an account")}</Link>
        </>
      }
    >
      {/* Notices arrive as English msg() keys and are translated here, so they follow a language switch. */}
      {location.state?.notice && <div className="alert alert-info small">{t(location.state.notice)}</div>}
      <form onSubmit={handleSubmit(signIn)} noValidate>
        <FormField label={t("Email")} type="email" autoComplete="email" autoFocus {...field("email")} />
        <PasswordField label={t("Password")} autoComplete="current-password" {...field("password")} />
        <button className="btn btn-primary w-100 py-2" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label={t("Signing in")} /> : t("Sign in")}
        </button>
      </form>
    </AuthCard>
  );
}
