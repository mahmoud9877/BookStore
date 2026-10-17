import jwt from "jsonwebtoken";

/** Signs and verifies JWTs with one secret (login and email tokens use separate instances). */
export class JwtTokenService {
  #secret;

  constructor(secret) {
    this.#secret = secret;
  }

  sign(payload, expiresInSeconds = 60 * 60) {
    return jwt.sign(payload, this.#secret, { expiresIn: parseInt(expiresInSeconds) });
  }

  /** Throws JsonWebTokenError / TokenExpiredError for invalid tokens. */
  verify(token) {
    return jwt.verify(token, this.#secret);
  }
}
