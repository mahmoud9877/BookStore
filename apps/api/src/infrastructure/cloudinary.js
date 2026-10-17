import cloudinary from "cloudinary";
import { env } from "../config/env.js";

const { cloudName, apiKey, apiSecret } = env.cloudinary;
const isConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isConfigured) {
  cloudinary.v2.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

/** Uploads a local file and returns Cloudinary's `{ secure_url, public_id }`. */
export async function uploadImage(filePath, folder) {
  if (!isConfigured) {
    throw new Error("Image uploads are not configured", { cause: 503 });
  }
  try {
    return await cloudinary.v2.uploader.upload(filePath, {
      folder: `${env.appName}/${folder}`,
    });
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw new Error("Failed to upload image to Cloudinary", { cause: 502 });
  }
}
