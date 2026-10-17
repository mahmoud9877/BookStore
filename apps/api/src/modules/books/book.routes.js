import { Router } from "express";
import * as bookController from "./book.controller.js";
import * as validators from "./book.validation.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { fileUpload, allowedMimeTypes } from "../../middleware/upload.js";

const router = Router();
const adminOnly = authenticate([USER_ROLES.Admin]);
const imageUpload = fileUpload(allowedMimeTypes.image).single("image");

router.get("/", bookController.listBooks);
router.get("/:bookId", validate(validators.bookIdParam), bookController.getBookById);

router.post(
  "/add",
  adminOnly,
  imageUpload,
  validate(validators.addBook),
  bookController.addBook
);
router.post(
  "/edit/:id",
  adminOnly,
  imageUpload,
  validate(validators.updateBook),
  bookController.updateBook
);
router.delete(
  "/delete/:id",
  adminOnly,
  validate(validators.deleteBook),
  bookController.deleteBook
);

router.patch(
  "/:bookId/like",
  authenticate(),
  validate(validators.bookIdParam),
  bookController.likeBook
);
router.patch(
  "/:bookId/unlike",
  authenticate(),
  validate(validators.bookIdParam),
  bookController.unlikeBook
);

export default router;
