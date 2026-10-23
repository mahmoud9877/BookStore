import React from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthCard from "../components/AuthCard.jsx";
import { signup } from "../services/auth.service.js";
import useForm from "../../../hooks/useForm.js";
import { signupSchema } from "../utils/auth.validation.js";
import Spinner from "../../../components/ui/Spinner.jsx";
import { getErrorMessage } from "../../../lib/api-client.js";
import FormField, { PasswordField } from "../../../components/ui/FormField.jsx";
import { msg, t } from "../../../i18n/index.js";

const SIGNUP_SUCCESS_NOTICE = msg(
  "Your account is ready. If we sent you a confirmation email, confirm your address before signing in."
);

export default function SignupPage() {
  const navigate = useNavigate();
  const { values, field, formError, isSubmitting, handleSubmit } = useForm(
    { userName: "", email: "", password: "", cPassword: "" },
    {
      schema: signupSchema,
      errorMessage: (err) => getErrorMessage(err, t("We couldn't create your account. Please try again.")),
    }
  );

  async function createAccount() {
    await signup(values); // the API checks cPassword too, so send the form as typed
    navigate("/login", { state: { notice: SIGNUP_SUCCESS_NOTICE } });
  }

  return (
    <AuthCard
      title={t("Create your account")}
      subtitle={t("Save books to your cart and check out in minutes.")}
      error={formError}
      footer={
        <>
          {t("Already have an account?")} <Link to="/login">{t("Sign in")}</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(createAccount)} noValidate>
        <FormField label={t("Name")} autoComplete="name" autoFocus {...field("userName")} />
        <FormField label={t("Email")} type="email" autoComplete="email" {...field("email")} />
        <PasswordField label={t("Password")} autoComplete="new-password" hint={t("At least 6 characters.")} {...field("password")} />
        <PasswordField label={t("Confirm password")} autoComplete="new-password" {...field("cPassword")} />
        <button className="btn btn-primary w-100 py-2" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Spinner label={t("Creating account")} /> : t("Create account")}
        </button>
      </form>
    </AuthCard>
  );
}
