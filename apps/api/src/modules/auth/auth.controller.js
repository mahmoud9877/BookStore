import { publicBaseUrl } from "../../core/http-request.js";
import { asyncHandler } from "../../middleware/error-handler.js";

export class AuthController {
  #authService;

  constructor(authService) {
    this.#authService = authService;
  }

  signup = asyncHandler(async (req, res) => {
    const { _id, token, refreshToken } = await this.#authService.registerUser(req.body, {
      apiBaseUrl: publicBaseUrl(req),
    });
    return res.status(201).json({ message: "Done", _id, refreshToken, token });
  });

  confirmEmail = asyncHandler(async (req, res) => {
    const result = await this.#authService.confirmEmail(req.params.token);
    return sendConfirmationResult(res, result);
  });

  resendConfirmationEmail = asyncHandler(async (req, res) => {
    const result = await this.#authService.resendConfirmationEmail(req.params.token, {
      apiBaseUrl: publicBaseUrl(req),
    });
    return sendConfirmationResult(res, result);
  });

  login = asyncHandler(async (req, res) => {
    const { token, role } = await this.#authService.login(req.body);
    return res.status(200).json({ message: "Done", token, role });
  });

  listUsers = asyncHandler(async (req, res) => {
    return res.json({ message: "done", users: await this.#authService.listUsers() });
  });
}

const sendConfirmationResult = (res, { redirectUrl, message }) =>
  redirectUrl ? res.redirect(redirectUrl) : res.status(200).json({ message });
