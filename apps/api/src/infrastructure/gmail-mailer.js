import nodemailer from "nodemailer";

export class GmailMailer {
  #user;
  #password;
  #transporter;

  #fromName;

  constructor({ user, password, fromName = "Library" } = {}) {
    this.#user = user;
    this.#password = password;
    this.#fromName = fromName;
  }

  get isConfigured() {
    return Boolean(this.#user && this.#password);
  }

  /** Resolves true when no recipient was rejected; never throws. */
  async send({ to = [], subject, html, text, attachments = [] } = {}) {
    try {
      this.#transporter ??= nodemailer.createTransport({
        service: "gmail",
        auth: { user: this.#user, pass: this.#password },
        // Never let a slow mail server hold a request or a worker forever.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      const info = await this.#transporter.sendMail({
        from: `"${this.#fromName.replace(/"/g, "")}" <${this.#user}>`,
        to: Array.isArray(to) ? to.join(",") : to,
        subject: subject || "Hello ✔",
        html: html || `<p>Hello world?</p>`,
        text,
        attachments,
      });
      console.log("Message sent: %s", info.messageId);
      return !info.rejected.length;
    } catch (error) {
      console.error("Error sending email:", error.message);
      return false;
    }
  }
}
