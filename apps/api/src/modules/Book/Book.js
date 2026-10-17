import cloudinary from "../../utils/cloudinary.js";
import bookModel from "../../../DB/modules/bookModel.js"; // Make sure you have cloudinary configured
import { asyncHandler } from "../../utils/errorHandling.js";
import { categoryModel } from "../../../DB/modules/categoryModel.js"; // Assuming you're using this model for categories

// Get a book from the database
export const getBook = asyncHandler(async (req, res, next) => {
  try {
    const checkBook = await bookModel.find({});
    if (!checkBook) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json({ book: checkBook });
  } catch (error) {
    next(error);
  }
});

export const getBookDetails = asyncHandler(async (req, res, next) => {
  const { bookId } = req.params; // Assuming the book ID is passed in the URL
  // Find the book by its ID
  const book = await bookModel.findById(bookId);

  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  // If found, return the book details
  return res.status(200).json({ message: "Done", book });
});

export const addBook = asyncHandler(async (req, res, next) => {
  try {
    const { bookTitle, author, description, price, category, quantity } =
      req.body;

    // Check for required fields
    if (
      !bookTitle ||
      !author ||
      !description ||
      !price ||
      !category ||
      !quantity
    ) {
      return res.status(400).json({
        error:
          "All fields are required: book title, author, description, price, category name, quantity.",
      });
    }

    // Check if category exists by name
    const categoryData = await categoryModel.findOne({ name: category });
    if (!categoryData) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if an image file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: "Image file is required",
      });
    }

    // Upload the image to Cloudinary
    let secure_url, public_id;
    try {
      const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
        folder: `${process.env.APP_NAME}/book`,
      });
      secure_url = uploadResponse.secure_url;
      public_id = uploadResponse.public_id;
    } catch (uploadError) {
      return res.status(500).json({
        error: "Failed to upload image to Cloudinary",
      });
    }

    // Create new book
    const newBook = await bookModel.create({
      bookTitle,
      author,
      description,
      image: secure_url, // Save the image URL
      price,
      category, // Use the category ID
      quantity,
    });

    return res.status(201).json({
      message: "Book added successfully",
      book: newBook,
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    next(error);
  }
});

export const updateBook = asyncHandler(async (req, res) => {
  try {
    const { bookTitle, author, description, price, category, quantity } =
      req.body;
    console.log(req.body);

    // Check for required fields
    if (
      !bookTitle ||
      !author ||
      !description ||
      !price ||
      !category ||
      !quantity
    ) {
      return res.status(400).json({
        error:
          "All fields are required: book title, author, description, price, category, quantity.",
      });
    }

    // Check if an image file was uploaded
    if (req.file) {
      // Upload the image to Cloudinary
      const { secure_url, public_id } = await cloudinary.uploader.upload(
        req.file.path,
        {
          folder: `${process.env.APP_NAME}/book`,
        }
      );
      console.log(secure_url, public_id);
    }

    // Check if category already exists
    let existingCategory = await categoryModel.findById({
      _id: category,
    });
    console.log(existingCategory);

    // let categoryId;
    // if (existingCategory) {
    //   categoryId = existingCategory._id; // Use the existing category
    // } else {
    //   // Create new category if it doesn't exist
    //   const createCategory = await categoryModel.create({
    //     name: category.toLowerCase(), // Save category in lowercase
    //     image: { secure_url, public_id },
    //   });
    //   categoryId = createCategory._id; // Store the new category ID
    // }
    if (req.file) {
      // Create new book
      const newBook = await bookModel.findByIdAndUpdate(
        { _id: req.params.id },
        {
          bookTitle,
          author,
          description,
          image: secure_url, // Save the image URL
          price,
          category: existingCategory._id, // Link to the existing or newly created category
          quantity,
        }
      );
      return res.status(201).json({
        message: "Book added successfully",
        book: newBook,
        existingCategory,
      });
    } else {
      // Create new book
      console.log(req.params.id);

      const newBook = await bookModel.findByIdAndUpdate(
        { _id: req.params.id },
        {
          bookTitle,
          author,
          description,
          price,
          //  category: existingCategory._id, // Link to the existing or newly created category
          quantity,
        }
      );
      return res.status(201).json({
        message: "Book updated successfully",
        book: newBook,
        existingCategory,
      });
    }
  } catch (error) {
    console.log(error);
  }
});

export const deleteBook = asyncHandler(async (req, res) => {
  try {
    console.log(req.params.id);
    const book = await bookModel.findByIdAndDelete(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.status(200).json({ message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting book", error });
  }
});

export const likeBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const userId = req.user.userId; // تأكيد أن userId يأتي من المصادقة

  console.log({ bookId, userId });

  // العثور على الكتاب وتحديث الإعجابات
  const likeBook = await bookModel.findOneAndUpdate(
    { _id: bookId, likes: { $ne: userId } }, // التأكد أن المستخدم لم يعجب بالكتاب من قبل
    {
      $push: { likes: userId }, // إضافة userId إلى مصفوفة الإعجابات
      $inc: { totalLikes: 1 }, // زيادة عدد الإعجابات
    },
    { new: true } // إرجاع المستند بعد التعديل
  );

  // التحقق مما إذا كان الكتاب غير موجود أو أن المستخدم قام بالإعجاب مسبقًا
  if (!likeBook) {
    return res.status(400).json({ message: "Book not found or already liked" });
  }

  return res.json({ message: "Book liked successfully", likeBook });
});

export const unLikeBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { userId } = req.body; // Ensure userId is coming from authentication

  // Find and update the book
  const unLikeBook = await bookModel.findOneAndUpdate(
    { _id: bookId, like: userId }, // Ensure user has liked the book
    { $pull: { like: userId } }, // Remove userId from the like array
    { new: true } // Return updated document
  );

  // If the book wasn't found or the user hasn't liked it
  if (!unLikeBook) {
    return res.status(400).json({ message: "Book not found or not liked yet" });
  }

  return res.json({ message: "Book unliked successfully", unLikeBook });
});
