import { Router } from "express";
import {
  BookIdDto,
  CreateBookDto,
  DeleteBookDto,
  ListBooksQueryDto,
  UpdateBookDto,
} from "./book.dto.js";
import { validate } from "../../middleware/validate.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { UPLOAD_LIMITS, allowedMimeTypes, fileUpload } from "../../middleware/upload.js";

export function createBookRouter({ bookController, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.BooksManage);
  const imageUpload = fileUpload(allowedMimeTypes.image, { maxBytes: UPLOAD_LIMITS.image }).single("image");

  router.get("/", validate(ListBooksQueryDto), bookController.listBooks);
  router.get("/:bookId", validate(BookIdDto), bookController.getBookById);
  router.get("/:bookId/editions", validate(BookIdDto), bookController.listEditions);

  router.post("/add", canManage, imageUpload, validate(CreateBookDto), bookController.addBook);
  router.post(
    "/edit/:id",
    canManage,
    imageUpload,
    validate(UpdateBookDto),
    bookController.updateBook
  );
  router.delete(
    "/delete/:id",
    canManage,
    validate(DeleteBookDto),
    bookController.deleteBook
  );

  router.patch(
    "/:bookId/like",
    authGuard.signedIn(),
    validate(BookIdDto),
    bookController.likeBook
  );
  router.patch(
    "/:bookId/unlike",
    authGuard.signedIn(),
    validate(BookIdDto),
    bookController.unlikeBook
  );

  return router;
}
