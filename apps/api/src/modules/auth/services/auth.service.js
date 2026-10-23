import { createHash, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "../../../core/http-errors.js";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const REFRESH_ROTATION_GRACE_MS = 10_000;

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const invalidRefreshToken = () => new UnauthorizedError("Invalid or expired refresh token");

/** Account registration and login. */
export class AuthService {
  #users;
  #passwordHasher;
  #accessTokens;
  #refreshTokens;
  #authSessions;
  #emailConfirmation;
  #requireEmailConfirmation;

  constructor({
    userRepository,
    passwordHasher,
    accessTokens,
    refreshTokens,
    authSessionRepository,
    emailConfirmation,
    requireEmailConfirmation = true,
  }) {
    this.#users = userRepository;
    this.#passwordHasher = passwordHasher;
    this.#accessTokens = accessTokens;
    this.#refreshTokens = refreshTokens;
    this.#authSessions = authSessionRepository;
    this.#emailConfirmation = emailConfirmation;
    this.#requireEmailConfirmation = requireEmailConfirmation;
  }

  /**
   * @param {import("../dtos/auth.dto.js").RegisterUserDto} dto
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
   * Checks credentials and resolves `{ accessToken, refreshToken, role }`.
   * @param {import("../dtos/auth.dto.js").LoginDto} dto
   */
  async login({ email, password }) {
    const user = await this.#users.findByAnyEmail([email.toLowerCase(), email]);

    if (!user) throw new NotFoundError("Email Not found");
    if (user.isActive === false) throw new UnauthorizedError("This account has been deactivated");
    if (!user.confirmEmail) throw new ForbiddenError("Confirm Your Email");
    if (!this.#passwordHasher.compare(password, user.password)) {
      throw new UnauthorizedError("Wrong Password");
    }

    return { ...(await this.#createTokenPair(user)), role: user.role };
  }

  async refresh(refreshToken) {
    if (!refreshToken) throw invalidRefreshToken();

    let claims;
    try {
      claims = this.#refreshTokens.verify(refreshToken);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) throw invalidRefreshToken();
      throw error;
    }
    if (claims.type !== "refresh" || !claims.id || !claims.sid) throw invalidRefreshToken();

    const currentHash = hashToken(refreshToken);
    let session = await this.#authSessions.findById(claims.sid);
    if (!session) throw invalidRefreshToken();
    const isCurrentToken = session.refreshTokenHash === currentHash;
    const isConcurrentRetry = this.#isConcurrentRetry(session, currentHash);
    if (!isCurrentToken && !isConcurrentRetry) {
      await this.#authSessions.deleteById(claims.sid);
      throw invalidRefreshToken();
    }

    const user = await this.#users.findAuthUserById(claims.id);
    if (!user || user.isActive === false || !user.confirmEmail) {
      await this.#authSessions.deleteById(claims.sid);
      throw invalidRefreshToken();
    }

    if (isConcurrentRetry) return { accessToken: this.#createAccessToken(user) };

    const nextRefreshToken = this.#refreshTokens.sign(
      { id: String(user._id), sid: claims.sid, type: "refresh", jti: randomUUID() },
      REFRESH_TOKEN_TTL_SECONDS
    );
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
    const previousRefreshTokenValidUntil = new Date(Date.now() + REFRESH_ROTATION_GRACE_MS);
    const rotated = await this.#authSessions.rotate(
      claims.sid,
      currentHash,
      hashToken(nextRefreshToken),
      expiresAt,
      previousRefreshTokenValidUntil
    );
    if (!rotated) {
      session = await this.#authSessions.findById(claims.sid);
      if (session && this.#isConcurrentRetry(session, currentHash)) {
        return { accessToken: this.#createAccessToken(user) };
      }
      throw invalidRefreshToken();
    }

    return {
      accessToken: this.#createAccessToken(user),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken) {
    if (!refreshToken) return;
    let claims;
    try {
      claims = this.#refreshTokens.verify(refreshToken);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) return;
      throw error;
    }
    if (claims.type === "refresh" && claims.sid) await this.#authSessions.deleteById(claims.sid);
  }

  async #createTokenPair(user) {
    const sessionId = randomUUID();
    const refreshToken = this.#refreshTokens.sign(
      { id: String(user._id), sid: sessionId, type: "refresh", jti: randomUUID() },
      REFRESH_TOKEN_TTL_SECONDS
    );
    await this.#authSessions.create({
      _id: sessionId,
      userId: user._id,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });
    return {
      accessToken: this.#createAccessToken(user),
      refreshToken,
    };
  }

  #createAccessToken(user) {
    return this.#accessTokens.sign(
      { id: user._id, userName: user.userName, role: user.role, type: "access" },
      ACCESS_TOKEN_TTL_SECONDS
    );
  }

  #isConcurrentRetry(session, currentHash) {
    return session.previousRefreshTokenHash === currentHash
      && session.previousRefreshTokenValidUntil > new Date();
  }
}
