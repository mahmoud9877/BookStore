import { asyncHandler } from "../../middleware/error-handler.js";

export class UserController {
  #userService;

  constructor(userService) {
    this.#userService = userService;
  }

  getCurrentUser = asyncHandler(async (req, res) => {
    return res.json({ user: await this.#userService.getCurrentUser(req.user._id) });
  });

  listUsers = asyncHandler(async (req, res) => {
    return res.json({ message: "done", ...(await this.#userService.listUsers(req.dto)) });
  });

  changeRole = asyncHandler(async (req, res) => {
    const user = await this.#userService.changeRole(req.dto, req.access);
    return res.json({ message: "Role updated successfully", user });
  });

  updateAccess = asyncHandler(async (req, res) => {
    const user = await this.#userService.updateAccess(req.dto, req.access);
    return res.json({ message: "Account updated successfully", user });
  });
}
