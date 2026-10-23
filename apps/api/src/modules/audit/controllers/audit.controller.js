import { asyncHandler } from "../../../middleware/error-handler.js";

export class AuditController {
  #auditService;

  constructor(auditService) {
    this.#auditService = auditService;
  }

  list = asyncHandler(async (req, res) => res.json(await this.#auditService.list(req.dto, req.access)));
}
