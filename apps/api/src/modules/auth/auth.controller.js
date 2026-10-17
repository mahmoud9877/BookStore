import { env } from "../../config/env.js";
import userModel from "../users/user.model.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import { generateToken, verifyToken } from "../../security/token.js";
import { hashPassword, comparePassword } from "../../security/password.js";
import { isMailerConfigured, sendEmail } from "../../infrastructure/mailer.js";
import { confirmationEmailHtml } from "./confirmation-email.template.js";

const CONFIRMATION_TOKEN_TTL = 60 * 5;
const CONFIRMATION_REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30;
const LOGIN_TOKEN_TTL = 30 * 60 * 24 * 365;

const createConfirmationToken = (email, expiresIn) =>
  generateToken({ payload: { email }, signature: env.emailToken, expiresIn });

const baseUrl = (req) => `${req.protocol}://${req.headers.host}`;

async function sendConfirmationEmail({ req, email, userName, phone, token }) {
  if (!isMailerConfigured()) {
    console.warn("Mailer is not configured; confirmation email not sent.");
    return;
  }
  const link = `${baseUrl(req)}/auth/confirmEmail/${token}`;
  await sendEmail({
    to: email,
    subject: "Confirmation-Email",
    html: confirmationEmailHtml({ userName, phone, link }),
  });
}

export const listUsers = asyncHandler(async (req, res) => {
  const users = await userModel.find({}).select("-password -code");
  return res.json({ message: "done", users });
});

export const signup = asyncHandler(async (req, res, next) => {
  const { userName, email, password, phone } = req.body;
  const normalizedEmail = email.toLowerCase();

  if (await userModel.findOne({ email: normalizedEmail })) {
    return next(new Error("Email already exists", { cause: 409 }));
  }
  if (phone && (await userModel.findOne({ phone }))) {
    return next(new Error("Phone number already exists", { cause: 409 }));
  }

  const token = createConfirmationToken(normalizedEmail, CONFIRMATION_TOKEN_TTL);
  const refreshToken = createConfirmationToken(
    normalizedEmail,
    CONFIRMATION_REFRESH_TOKEN_TTL
  );

  const { _id } = await userModel.create({
    userName,
    email: normalizedEmail,
    password: hashPassword({ plaintext: password }),
    phone,
    confirmEmail: !env.requireEmailConfirmation,
  });

  if (env.requireEmailConfirmation) {
    await sendConfirmationEmail({ req, email: normalizedEmail, userName, phone, token });
  }

  return res.status(201).json({ message: "Done", _id, refreshToken, token });
});

async function markEmailConfirmed(email) {
  return userModel.findOneAndUpdate({ email }, { confirmEmail: true });
}

function respondConfirmed(res) {
  if (env.frontendUrl) return res.redirect(`${env.frontendUrl}/#/login`);
  return res.status(200).json({ message: "Done" });
}

export const confirmEmail = asyncHandler(async (req, res, next) => {
  const { email } = verifyToken({ token: req.params.token, signature: env.emailToken });
  if (!(await markEmailConfirmed(email))) {
    return next(new Error("Not registered account", { cause: 404 }));
  }
  return respondConfirmed(res);
});

/** Long-lived link: confirms directly, or re-sends a fresh short-lived link. */
export const resendConfirmationEmail = asyncHandler(async (req, res, next) => {
  const { email } = verifyToken({ token: req.params.token, signature: env.emailToken });
  const user = await userModel.findOne({ email });
  if (!user) {
    return next(new Error("Not registered account", { cause: 404 }));
  }
  if (user.confirmEmail) {
    return respondConfirmed(res);
  }
  const token = createConfirmationToken(email, CONFIRMATION_TOKEN_TTL);
  await sendConfirmationEmail({ req, email, userName: user.userName, phone: user.phone, token });
  return res.status(200).json({ message: "Check your inbox" });
});

export const login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;
  // Accounts created before emails were normalized may be stored with mixed case.
  const user = await userModel.findOne({
    email: { $in: [email.toLowerCase(), email] },
  });

  if (!user) {
    return next(new Error("Email Not found", { cause: 404 }));
  }
  if (!user.confirmEmail) {
    return next(new Error("Confirm Your Email", { cause: 403 }));
  }
  if (!comparePassword({ plaintext: password, hashValue: user.password })) {
    return next(new Error("Wrong Password", { cause: 401 }));
  }

  const token = generateToken({
    payload: { id: user._id, userName: user.userName, role: user.role },
    expiresIn: LOGIN_TOKEN_TTL,
  });

  return res.status(200).json({ message: "Done", token, role: user.role });
});
