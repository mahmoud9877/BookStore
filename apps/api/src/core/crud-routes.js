import { Router } from "express";
import { validate } from "../middleware/validate.js";

/**
 * Standard REST routes for a CrudController:
 *   GET / (ListDto), GET /:id, POST / (CreateDto), PATCH /:id (UpdateDto), DELETE /:id.
 * `read` and `write` are auth middleware; reads default to `write`.
 */
export function crudRouter({ controller, dtos, write, read = write }) {
  const router = Router();
  router.get("/", read, validate(dtos.List), controller.list);
  router.get("/:id", read, validate(dtos.Id), controller.get);
  router.post("/", write, validate(dtos.Create), controller.create);
  router.patch("/:id", write, validate(dtos.Update), controller.update);
  router.delete("/:id", write, validate(dtos.Id), controller.remove);
  return router;
}
