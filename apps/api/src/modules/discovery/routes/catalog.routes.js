import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { asyncHandler } from "../../../middleware/error-handler.js";
import { CatalogSearchDto, RelatedDto } from "../services/catalog.service.js";

export function createCatalogRouter({ catalogService }) {
  const router = Router();
  router.get("/search", validate(CatalogSearchDto), asyncHandler(async (req, res) => res.json(await catalogService.search(req.dto))));
  router.get("/:bookId/related", validate(RelatedDto), asyncHandler(async (req, res) => res.json({ data: await catalogService.related(req.dto) })));
  return router;
}
