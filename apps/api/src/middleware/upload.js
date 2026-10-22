import multer from "multer";

export const allowedMimeTypes = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  file: ["application/pdf", "application/msword"],
  video: ["video/mp4"],
  // Digital library publications.
  publication: ["application/pdf", "application/epub+zip", "audio/mpeg", "video/mp4"],
};

const MB = 1024 * 1024;

/**
 * Multer instance that stores uploads in the OS temp dir and filters by MIME type.
 * Uploads larger than `maxBytes` are rejected (413).
 */
export function fileUpload(acceptedMimeTypes = [], { maxBytes = 10 * MB } = {}) {
  const storage = multer.diskStorage({});
  function fileFilter(req, file, cb) {
    if (acceptedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file format", { cause: 400 }), false);
    }
  }
  return multer({ fileFilter, storage, limits: { fileSize: maxBytes, files: 1 } });
}

export const UPLOAD_LIMITS = Object.freeze({ image: 10 * MB, publication: 200 * MB });
