import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export const isMailerConfigured = () => Boolean(env.mail.user && env.mail.password);

/** Sends an email through Gmail. Resolves to true when no recipient was rejected. */
export async function sendEmail({ to = [], subject, html, attachments = [] } = {}) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: env.mail.user, pass: env.mail.password },
    });

    const info = await transporter.sendMail({
      from: `"70ka Company" <${env.mail.user}>`,
      to: Array.isArray(to) ? to.join(",") : to,
      subject: subject || "Hello ✔",
      html: html || `<p>Hello world?</p>`,
      attachments,
    });
    console.log("Message sent: %s", info.messageId);
    return !info.rejected.length;
  } catch (error) {
    console.error("Error sending email:", error.message);
    return false;
  }
}
