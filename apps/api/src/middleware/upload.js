import multer from "multer";

export const allowedMimeTypes = {
  image: ["image/jpeg", "image/png", "image/gif"],
  file: ["application/pdf", "application/msword"],
  video: ["video/mp4"],
};

/** Multer instance that stores uploads in the OS temp dir and filters by MIME type. */
export function fileUpload(acceptedMimeTypes = []) {
  const storage = multer.diskStorage({});
  function fileFilter(req, file, cb) {
    if (acceptedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file format", { cause: 400 }), false);
    }
  }
  return multer({ fileFilter, storage });
}
