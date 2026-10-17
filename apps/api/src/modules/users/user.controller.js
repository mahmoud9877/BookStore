import { asyncHandler } from "../../middleware/error-handler.js";

export class UserController {
  #userService;

  constructor(userService) {
    this.#userService = userService;
  }

  listUsers = asyncHandler(async (req, res) => {
    return res.json({ message: "done", users: await this.#userService.listUsers() });
  });
}
