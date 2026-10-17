import nodemailer from "nodemailer";

export class GmailMailer {
  #user;
  #password;
  #transporter;

  constructor({ user, password } = {}) {
    this.#user = user;
    this.#password = password;
  }

  get isConfigured() {
    return Boolean(this.#user && this.#password);
  }

  /** Resolves true when no recipient was rejected; never throws. */
  async send({ to = [], subject, html, attachments = [] } = {}) {
    try {
      this.#transporter ??= nodemailer.createTransport({
        service: "gmail",
        auth: { user: this.#user, pass: this.#password },
      });
      const info = await this.#transporter.sendMail({
        from: `"70ka Company" <${this.#user}>`,
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
}
