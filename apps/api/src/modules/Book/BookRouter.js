import { Router } from "express";
import * as BookController from "./Book.js"; // Ensure this imports the necessary methods
import { endpoint } from "./Book.endpoint.js";
import { auth } from "../../middleware/auth.js";
import { validation } from "../../middleware/validation.js";
import * as validators from "./BookValidation.js";
import { fileUpload, fileValidation } from "../../utils/multer.js"; // Ensure your file upload utility is imported
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
