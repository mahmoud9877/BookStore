import cloudinary from "cloudinary";
import { BadGatewayError, ServiceUnavailableError } from "../core/http-errors.js";

export class CloudinaryImageStorage {
  #rootFolder;

  constructor({ cloudName, apiKey, apiSecret } = {}, rootFolder = "bookstore") {
    this.#rootFolder = rootFolder;
    this.isConfigured = Boolean(cloudName && apiKey && apiSecret);
    if (this.isConfigured) {
      cloudinary.v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  /** Uploads a local file; resolves Cloudinary's `{ secure_url, public_id }`. */
  async upload(filePath, folder) {
    if (!this.isConfigured) {
      throw new ServiceUnavailableError("Image uploads are not configured");
    }
    try {
      return await cloudinary.v2.uploader.upload(filePath, {
        folder: `${this.#rootFolder}/${folder}`,
      });
    } catch (error) {
      console.error("Cloudinary upload failed:", error.message);
      throw new BadGatewayError("Failed to upload image to Cloudinary");
    }
  }
}
