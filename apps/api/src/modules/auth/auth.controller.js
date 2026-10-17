import { publicBaseUrl } from "../../core/http-request.js";
import { asyncHandler } from "../../middleware/error-handler.js";

const sendConfirmationResult = (res, { redirectUrl, message }) =>
  redirectUrl ? res.redirect(redirectUrl) : res.status(200).json({ message });

export class AuthController {
  #authService;
  #emailConfirmation;

  constructor(authService, emailConfirmationService) {
    this.#authService = authService;
    this.#emailConfirmation = emailConfirmationService;
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
    const { token, role } = await this.#authService.login(req.dto);
    return res.status(200).json({ message: "Done", token, role });
  });
}
