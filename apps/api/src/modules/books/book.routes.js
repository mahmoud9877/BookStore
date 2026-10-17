import { Router } from "express";
import {
  BookIdDto,
  CreateBookDto,
  DeleteBookDto,
  ListBooksQueryDto,
  UpdateBookDto,
} from "./book.dto.js";
import { USER_ROLES } from "../users/user.roles.js";
import { validate } from "../../middleware/validate.js";
import { fileUpload, allowedMimeTypes } from "../../middleware/upload.js";

export function createBookRouter({ bookController, authGuard }) {
  const router = Router();
  const adminOnly = authGuard.authenticate([USER_ROLES.Admin]);
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
    authGuard.authenticate(),
    validate(BookIdDto),
    bookController.likeBook
  );
  router.patch(
    "/:bookId/unlike",
    authGuard.authenticate(),
    validate(BookIdDto),
    bookController.unlikeBook
  );

  return router;
}
