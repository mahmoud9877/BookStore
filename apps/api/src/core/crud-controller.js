import { definedOnly } from "./dto.js";
import { asyncHandler } from "../middleware/error-handler.js";

/**
 * HTTP handlers for a CrudService: `{ data, meta }` lists, `{ data }` records.
 * Routes pass `req.dto` (validated) and `req.access` (the actor).
 */
export class CrudController {
  #service;

  constructor(service) {
    this.#service = service;
  }

  list = asyncHandler(async (req, res) => res.json(await this.#service.list(req.dto, req.access)));

  get = asyncHandler(async (req, res) => res.json({ data: await this.#service.get(req.dto.id, req.access) }));

  create = asyncHandler(async (req, res) => {
    const { id: _ignored, ...data } = req.dto;
    return res.status(201).json({ data: await this.#service.create(definedOnly(data), req.access) });
  });

  update = asyncHandler(async (req, res) => {
    const { id, ...data } = req.dto;
    return res.json({ data: await this.#service.update(id, definedOnly(data), req.access) });
  });

  remove = asyncHandler(async (req, res) => {
    await this.#service.remove(req.dto.id, req.access);
    return res.status(204).end();
  });
}
