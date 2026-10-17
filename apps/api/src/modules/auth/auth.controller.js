import { asyncHandler } from "../../middleware/error-handler.js";

// Behind the production nginx proxy the API is served under /api (X-Forwarded-Prefix).
const confirmUrl = (req) =>
  `${req.protocol}://${req.headers.host}${req.get("x-forwarded-prefix") ?? ""}/auth/confirmEmail`;

export class AuthController {
  #authService;
  #frontendUrl;

  constructor(authService, { frontendUrl } = {}) {
    this.#authService = authService;
    this.#frontendUrl = frontendUrl;
  }

  signup = asyncHandler(async (req, res) => {
    const { _id, token, refreshToken } = await this.#authService.registerUser(req.body, {
      confirmUrl: confirmUrl(req),
    });
    return res.status(201).json({ message: "Done", _id, refreshToken, token });
  });

  confirmEmail = asyncHandler(async (req, res) => {
    await this.#authService.confirmEmail(req.params.token);
    return this.#respondConfirmed(res);
  });

  resendConfirmationEmail = asyncHandler(async (req, res) => {
    const { alreadyConfirmed } = await this.#authService.resendConfirmationEmail(
      req.params.token,
      { confirmUrl: confirmUrl(req) }
    );
    if (alreadyConfirmed) return this.#respondConfirmed(res);
    return res.status(200).json({ message: "Check your inbox" });
  });

  login = asyncHandler(async (req, res) => {
    const { token, role } = await this.#authService.login(req.body);
    return res.status(200).json({ message: "Done", token, role });
  });

  listUsers = asyncHandler(async (req, res) => {
    return res.json({ message: "done", users: await this.#authService.listUsers() });
  });

  #respondConfirmed(res) {
    if (this.#frontendUrl) return res.redirect(`${this.#frontendUrl}/#/login`);
    return res.status(200).json({ message: "Done" });
  }
}
