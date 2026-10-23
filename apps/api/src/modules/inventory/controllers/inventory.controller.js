import { asyncHandler } from "../../../middleware/error-handler.js";

export class InventoryController {
  #service;

  constructor(stocktakeService) {
    this.#service = stocktakeService;
  }

  list = asyncHandler(async (req, res) => res.json(await this.#service.list(req.dto, req.access)));

  start = asyncHandler(async (req, res) =>
    res.status(201).json({ data: await this.#service.start(req.dto, req.access) })
  );

  get = asyncHandler(async (req, res) =>
    res.status(200).json({ data: await this.#service.get(req.dto.id, req.access) })
  );

  scan = asyncHandler(async (req, res) =>
    res.status(200).json({ data: await this.#service.scan(req.dto, req.access) })
  );

  close = asyncHandler(async (req, res) =>
    res.status(200).json({ data: await this.#service.close(req.dto, req.access) })
  );

  cancel = asyncHandler(async (req, res) =>
    res.status(200).json({ data: await this.#service.cancel(req.dto, req.access) })
  );
}
