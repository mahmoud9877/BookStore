import { UserResponseDto } from "./auth.dto.js";
import { confirmationEmailHtml } from "./confirmation-email.template.js";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../core/http-errors.js";

const CONFIRMATION_TOKEN_TTL = 60 * 5;
const CONFIRMATION_REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30;
const LOGIN_TOKEN_TTL = 30 * 60 * 24 * 365;

export class AuthService {
  #users;
  #passwordHasher;
  #accessTokens;
  #emailTokens;
  #mailer;
  #requireEmailConfirmation;
  #frontendUrl;

  constructor({
    userRepository,
    passwordHasher,
    accessTokens,
    emailTokens,
    mailer,
    requireEmailConfirmation = true,
    frontendUrl,
  }) {
    this.#users = userRepository;
    this.#passwordHasher = passwordHasher;
    this.#accessTokens = accessTokens;
    this.#emailTokens = emailTokens;
    this.#mailer = mailer;
    this.#requireEmailConfirmation = requireEmailConfirmation;
    this.#frontendUrl = frontendUrl;
  }

  /**
   * @param {import("./auth.dto.js").RegisterUserDto} dto
   * @param {{ apiBaseUrl: string }} context public API base URL for the confirmation link
   */
  async registerUser({ userName, email, password, phone }, { apiBaseUrl }) {
    const normalizedEmail = email.toLowerCase();

    if (await this.#users.findByEmail(normalizedEmail)) {
      throw new ConflictError("Email already exists");
    }
    if (phone && (await this.#users.findByPhone(phone))) {
      throw new ConflictError("Phone number already exists");
    }

    const { _id } = await this.#users.create({
      userName,
      email: normalizedEmail,
      password: this.#passwordHasher.hash(password),
      phone,
      confirmEmail: !this.#requireEmailConfirmation,
    });

    if (this.#requireEmailConfirmation) {
      await this.#sendConfirmationEmail({ email: normalizedEmail, userName, phone, apiBaseUrl });
    }

    return {
      _id,
      token: this.#emailTokens.sign({ email: normalizedEmail }, CONFIRMATION_TOKEN_TTL),
      refreshToken: this.#emailTokens.sign({ email: normalizedEmail }, CONFIRMATION_REFRESH_TOKEN_TTL),
    };
  }

  /**
   * Confirms the account behind an email token. Resolves `{ redirectUrl, message }`:
   * `redirectUrl` (the web app's login page) is null when no frontend is configured.
   */
  async confirmEmail(token) {
    const { email } = this.#emailTokens.verify(token);
    if (!(await this.#users.markEmailConfirmed(email))) {
      throw new NotFoundError("Not registered account");
    }
    return this.#confirmedResult();
  }

  /**
   * Handles the long-lived confirmation link: resends a fresh short-lived link
   * unless the account is already confirmed. Resolves `{ redirectUrl, message }`.
   */
  async resendConfirmationEmail(refreshToken, { apiBaseUrl }) {
    const { email } = this.#emailTokens.verify(refreshToken);
    const user = await this.#users.findByEmail(email);
    if (!user) {
      throw new NotFoundError("Not registered account");
    }
    if (user.confirmEmail) {
      return this.#confirmedResult();
    }
    await this.#sendConfirmationEmail({
      email,
      userName: user.userName,
      phone: user.phone,
      apiBaseUrl,
    });
    return { redirectUrl: null, message: "Check your inbox" };
  }

  /**
   * Checks credentials and resolves `{ token, role }`.
   * @param {import("./auth.dto.js").LoginDto} dto
   */
  async login({ email, password }) {
    const user = await this.#users.findByAnyEmail([email.toLowerCase(), email]);

    if (!user) {
      throw new NotFoundError("Email Not found");
    }
    if (!user.confirmEmail) {
      throw new ForbiddenError("Confirm Your Email");
    }
    if (!this.#passwordHasher.compare(password, user.password)) {
      throw new UnauthorizedError("Wrong Password");
    }

    const token = this.#accessTokens.sign(
      { id: user._id, userName: user.userName, role: user.role },
      LOGIN_TOKEN_TTL
    );
    return { token, role: user.role };
  }

  async listUsers() {
    return UserResponseDto.fromList(await this.#users.listWithoutSecrets());
  }

  #confirmedResult() {
    return {
      redirectUrl: this.#frontendUrl ? `${this.#frontendUrl}/#/login` : null,
      message: "Done",
    };
  }

  async #sendConfirmationEmail({ email, userName, phone, apiBaseUrl }) {
    if (!this.#mailer.isConfigured) {
      console.warn("Mailer is not configured; confirmation email not sent.");
      return;
    }
    const token = this.#emailTokens.sign({ email }, CONFIRMATION_TOKEN_TTL);
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
}
