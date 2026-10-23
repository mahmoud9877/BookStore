import { publicBaseUrl } from "../../../core/http-request.js";
import { UnauthorizedError } from "../../../core/http-errors.js";
import { asyncHandler } from "../../../middleware/error-handler.js";

const sendConfirmationResult = (res, { redirectUrl, message }) =>
  redirectUrl ? res.redirect(redirectUrl) : res.status(200).json({ message });

const REFRESH_COOKIE = "refreshToken";

function refreshCookieOptions(config, req) {
  const prefix = req.get("x-forwarded-prefix")?.replace(/\/+$/, "") ?? "";
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? "none" : "lax",
    path: `${prefix}/auth`,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function refreshTokenFromCookie(req) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(REFRESH_COOKIE.length + 1));
  } catch {
    return undefined;
  }
}

export class AuthController {
  #authService;
  #emailConfirmation;
  #config;

  constructor(authService, emailConfirmationService, config) {
    this.#authService = authService;
    this.#emailConfirmation = emailConfirmationService;
    this.#config = config;
  }

  signup = asyncHandler(async (req, res) => {
    const { _id, token, refreshToken } = await this.#authService.registerUser(req.dto, {
      apiBaseUrl: publicBaseUrl(req),
    });
    return res.status(201).json({ message: "Done", _id, refreshToken, token });
  });

  confirmEmail = asyncHandler(async (req, res) => {
    return sendConfirmationResult(res, await this.#emailConfirmation.confirm(req.dto.token));
  });

  resendConfirmationEmail = asyncHandler(async (req, res) => {
    const result = await this.#emailConfirmation.resend(req.dto.token, {
      apiBaseUrl: publicBaseUrl(req),
    });
    return sendConfirmationResult(res, result);
  });

  login = asyncHandler(async (req, res) => {
    const { accessToken, refreshToken, role } = await this.#authService.login(req.dto);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(this.#config, req));
    return res.status(200).json({ message: "Done", accessToken, token: accessToken, role });
  });

  refresh = asyncHandler(async (req, res) => {
    try {
      const { accessToken, refreshToken } = await this.#authService.refresh(refreshTokenFromCookie(req));
      if (refreshToken) res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(this.#config, req));
      return res.status(200).json({ accessToken, token: accessToken });
    } catch (error) {
      if (error instanceof UnauthorizedError) res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.#config, req));
      throw error;
    }
  });

  logout = asyncHandler(async (req, res) => {
    await this.#authService.logout(refreshTokenFromCookie(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.#config, req));
    return res.status(200).json({ message: "Done" });
  });
}
