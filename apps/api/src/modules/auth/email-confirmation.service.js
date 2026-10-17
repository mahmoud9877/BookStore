import { NotFoundError } from "../../core/http-errors.js";
import { confirmationEmailHtml } from "./confirmation-email.template.js";

const CONFIRMATION_TOKEN_TTL = 60 * 5;
const CONFIRMATION_REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30;

/** Issues email-confirmation tokens, sends the confirmation email and confirms accounts. */
export class EmailConfirmationService {
  #users;
  #tokens;
  #mailer;
  #frontendUrl;

  constructor({ userRepository, emailTokens, mailer, frontendUrl }) {
    this.#users = userRepository;
    this.#tokens = emailTokens;
    this.#mailer = mailer;
    this.#frontendUrl = frontendUrl;
  }

  /** Short-lived `token` and long-lived `refreshToken` for `email`. */
  issueTokens(email) {
    return {
      token: this.#tokens.sign({ email }, CONFIRMATION_TOKEN_TTL),
      refreshToken: this.#tokens.sign({ email }, CONFIRMATION_REFRESH_TOKEN_TTL),
    };
  }

  /** `apiBaseUrl` is the API's public base URL, used to build the confirmation link. */
  async sendConfirmation({ email, userName, phone }, { apiBaseUrl }) {
    if (!this.#mailer.isConfigured) {
      console.warn("Mailer is not configured; confirmation email not sent.");
      return;
    }
    const token = this.#tokens.sign({ email }, CONFIRMATION_TOKEN_TTL);
    await this.#mailer.send({
      to: email,
      subject: "Confirmation-Email",
      html: confirmationEmailHtml({
        userName,
        phone,
        link: `${apiBaseUrl}/auth/confirmEmail/${token}`,
      }),
    });
  }

  /**
   * Confirms the account behind an email token. Resolves `{ redirectUrl, message }`:
   * `redirectUrl` (the web app's login page) is null when no frontend is configured.
   */
  async confirm(token) {
    const { email } = this.#tokens.verify(token);
    if (!(await this.#users.markEmailConfirmed(email))) {
      throw new NotFoundError("Not registered account");
    }
    return this.#confirmedResult();
  }

  /**
   * Handles the long-lived confirmation link: resends a fresh short-lived link
   * unless the account is already confirmed. Resolves `{ redirectUrl, message }`.
   */
  async resend(refreshToken, { apiBaseUrl }) {
    const { email } = this.#tokens.verify(refreshToken);
    const user = await this.#users.findByEmail(email);
    if (!user) throw new NotFoundError("Not registered account");
    if (user.confirmEmail) return this.#confirmedResult();

    await this.sendConfirmation(user, { apiBaseUrl });
    return { redirectUrl: null, message: "Check your inbox" };
  }

  #confirmedResult() {
    return {
      redirectUrl: this.#frontendUrl ? `${this.#frontendUrl}/#/login` : null,
      message: "Done",
    };
  }
}
