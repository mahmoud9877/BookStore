import { Router } from "express";
import {
  BookIdDto,
  CreateBookDto,
  DeleteBookDto,
  ListBooksQueryDto,
  UpdateBookDto,
} from "./book.dto.js";
import { validate } from "../../middleware/validate.js";
import { fileUpload, allowedMimeTypes } from "../../middleware/upload.js";

export function createBookRouter({ bookController, authGuard }) {
  const router = Router();
  const adminOnly = authGuard.adminOnly();
  const imageUpload = fileUpload(allowedMimeTypes.image).single("image");

  router.get("/", validate(ListBooksQueryDto), bookController.listBooks);
  router.get("/:bookId", validate(BookIdDto), bookController.getBookById);

  router.post("/add", adminOnly, imageUpload, validate(CreateBookDto), bookController.addBook);
  router.post(
    "/edit/:id",
    adminOnly,
    imageUpload,
    validate(UpdateBookDto),
    bookController.updateBook
  );
  router.delete(
    "/delete/:id",
    adminOnly,
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
