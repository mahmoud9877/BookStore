import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../core/http-errors.js";

const LOGIN_TOKEN_TTL = 30 * 60 * 24 * 365;

/** Account registration and login. */
export class AuthService {
  #users;
  #passwordHasher;
  #accessTokens;
  #emailConfirmation;
  #requireEmailConfirmation;

  constructor({
    userRepository,
    passwordHasher,
    accessTokens,
    emailConfirmation,
    requireEmailConfirmation = true,
  }) {
    this.#users = userRepository;
    this.#passwordHasher = passwordHasher;
    this.#accessTokens = accessTokens;
    this.#emailConfirmation = emailConfirmation;
    this.#requireEmailConfirmation = requireEmailConfirmation;
  }

  /**
   * @param {import("./auth.dto.js").RegisterUserDto} dto
   * @param {{ apiBaseUrl: string }} context public API base URL for the confirmation link
   * Resolves `{ _id, token, refreshToken }` (the email-confirmation tokens).
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
      await this.#emailConfirmation.sendConfirmation(
        { email: normalizedEmail, userName, phone },
        { apiBaseUrl }
      );
    }
    return { _id, ...this.#emailConfirmation.issueTokens(normalizedEmail) };
  }

  /**
   * Checks credentials and resolves `{ token, role }`.
   * @param {import("./auth.dto.js").LoginDto} dto
   */
  async login({ email, password }) {
    const user = await this.#users.findByAnyEmail([email.toLowerCase(), email]);

    if (!user) throw new NotFoundError("Email Not found");
    if (!user.confirmEmail) throw new ForbiddenError("Confirm Your Email");
    if (!this.#passwordHasher.compare(password, user.password)) {
      throw new UnauthorizedError("Wrong Password");
    }

    const token = this.#accessTokens.sign(
      { id: user._id, userName: user.userName, role: user.role },
      LOGIN_TOKEN_TTL
    );
    return { token, role: user.role };
  }
}
