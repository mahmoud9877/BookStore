/**
 * Mailer for development and tests: logs instead of sending, so no real email
 * ever leaves a developer machine. Selected with MAIL_TRANSPORT=log (the
 * default outside production) or when no email credentials are configured.
 */
export class LogMailer {
  constructor({ log = console.log } = {}) {
    this.log = log;
    this.isConfigured = true;
    this.sent = [];
  }

  async send({ to, subject }) {
    this.sent.push({ to, subject });
    this.log(`[mail:log] to=${to} subject=${JSON.stringify(subject)}`);
    return true;
  }
}
