import { asyncHandler } from "../../middleware/error-handler.js";

export class CopyController {
  #copyService;

  constructor(copyService) {
    this.#copyService = copyService;
  }

  list = asyncHandler(async (req, res) => res.json(await this.#copyService.list(req.dto, req.access)));

  get = asyncHandler(async (req, res) => res.json({ data: await this.#copyService.get(req.dto.id) }));

  getByBarcode = asyncHandler(async (req, res) => res.json({ data: await this.#copyService.getByBarcode(req.dto.barcode) }));

  create = asyncHandler(async (req, res) => res.status(201).json({ data: await this.#copyService.addCopies(req.dto, req.access) }));

  update = asyncHandler(async (req, res) => res.json({ data: await this.#copyService.updateCopy(req.dto, req.access) }));

  adjustStatus = asyncHandler(async (req, res) => res.json({ data: await this.#copyService.adjustStatus(req.dto, req.access) }));
}
