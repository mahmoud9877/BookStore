import { asyncHandler } from "../../../middleware/error-handler.js";

export class SettingsController {
  #settingsService;

  constructor(settingsService) {
    this.#settingsService = settingsService;
  }

  get = asyncHandler(async (req, res) => res.json({ data: await this.#settingsService.get() }));

  update = asyncHandler(async (req, res) => {
    const data = await this.#settingsService.update({ ...req.dto }, req.access);
    return res.json({ message: "Settings saved", data });
  });
}
