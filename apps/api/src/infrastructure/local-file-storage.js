import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { NotFoundError } from "../core/http-errors.js";

const SAFE_FOLDER = /^[a-z0-9-]+$/;
const SAFE_KEY = /^[a-z0-9-]+\/[a-f0-9]{32}\.[a-z0-9]{1,8}$/;

/**
 * Files on a local disk or mounted volume (Docker volume `uploads`). Keys are
 * random, so names never leak or collide. One instance per area: the public
 * area is served at /uploads (book covers); the private area (digital library)
 * is only ever streamed through an access-checked endpoint.
 */
export class LocalFileStorage {
  #root;

  constructor(root) {
    this.#root = path.resolve(root);
  }

  /** Copies an uploaded temp file in; resolves its storage key ("folder/<random>.<ext>"). */
  async save(tempPath, { folder, originalName }) {
    if (!SAFE_FOLDER.test(folder)) throw new Error(`Invalid storage folder: ${folder}`);
    const extension = (path.extname(originalName ?? "").slice(1).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin").slice(0, 8);
    const key = `${folder}/${crypto.randomBytes(16).toString("hex")}.${extension}`;
    await mkdir(path.join(this.#root, folder), { recursive: true });
    await copyFile(tempPath, this.#path(key));
    await rm(tempPath, { force: true });
    return key;
  }

  /** Resolves `{ stream, size }`; NotFoundError when the file is missing. */
  async open(key) {
    const filePath = this.#path(key);
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) throw new NotFoundError("File not found");
    return { stream: createReadStream(filePath), size: info.size };
  }

  async remove(key) {
    await rm(this.#path(key), { force: true });
  }

  get root() {
    return this.#root;
  }

  #path(key) {
    if (!SAFE_KEY.test(key)) throw new NotFoundError("File not found");
    return path.join(this.#root, key);
  }
}

/**
 * Cover images on local storage, used when Cloudinary is not configured.
 * Resolves the same `{ secure_url }` shape as CloudinaryImageStorage; the URL is
 * relative to the API (`/uploads/<key>`), which the web app prefixes.
 */
export class LocalImageStorage {
  #files;

  constructor(files) {
    this.#files = files;
    this.isConfigured = true;
  }

  async upload(filePath, folder, originalName = "cover.jpg") {
    const key = await this.#files.save(filePath, { folder, originalName });
    return { secure_url: `/uploads/${key}`, public_id: key };
  }
}
