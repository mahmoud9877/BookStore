import { Router } from "express";
import * as BookController from "./book.controller.js"; // Ensure this imports the necessary methods
import { endpoint } from "./book.endpoint.js";
import { auth } from "../../middleware/authenticate.js";
import { validation } from "../../middleware/validate.js";
import * as validators from "./book.validation.js";
import { fileUpload, fileValidation } from "../../middleware/upload.js"; // Ensure your file upload utility is imported
const router = Router();

// GET route to fetch all books
router.get("/", BookController.getBook); // Ensure this method is implemented

// POST route to add a new book
router.post(
  "/add",
  auth(endpoint.addBook),
  fileUpload(fileValidation.image).single("image"),
  BookController.addBook
);

router.patch(
  "/:bookId/like",
  auth(endpoint.deleteBook),
  validation(validators.likeOrUnlike),
  BookController.likeBook
);

router.patch(
  "/:bookId/unlike",
  auth,
  validation(validators.likeOrUnlike),
  BookController.unLikeBook
);

router.get("/:bookId", BookController.getBookDetails);

router.delete(
  "/delete/:id",
  auth(endpoint.deleteBook),
  BookController.deleteBook
);
router.post(
  "/edit/:id",
  auth(endpoint.updateBook),
  fileUpload(fileValidation.image).single("image"),
  BookController.updateBook
);

export default router;
