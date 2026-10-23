import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// apps/api/.env is the preferred location; config/.env is the legacy location
// and is still honored. Variables already set (e.g. by Docker) always win.
if (process.env.DISABLE_DOTENV !== "true") {
  dotenv.config({
    path: [path.join(apiRoot, ".env"), path.join(apiRoot, "config/.env")],
  });
}

const REQUIRED_VARIABLES = [
  "MONGODB_URI",
  "BEARER_KEY",
  "TOKEN_SIGNATURE",
  "EMAIL_TOKEN",
  "SALT_ROUND",
];

// Canonical name -> legacy names that are still accepted for backwards compatibility.
const LEGACY_NAMES = {
  MONGODB_URI: ["DB_LOCAL"],
  STRIPE_SECRET_KEY: ["Secret_Key", "SECRET_KEY"],
  STRIPE_WEBHOOK_SECRET: ["endpointSecret"],
  CLOUDINARY_CLOUD_NAME: ["CLOUD_NAME"],
  CLOUDINARY_API_KEY: ["API_KEY"],
  CLOUDINARY_API_SECRET: ["API_SECRET"],
  FRONTEND_URL: ["FE_URL"],
};

const deprecatedNamesInUse = [];

function read(name) {
  if (process.env[name]) return process.env[name];
  for (const legacyName of LEGACY_NAMES[name] ?? []) {
    if (process.env[legacyName]) {
      deprecatedNamesInUse.push(`${legacyName} (use ${name})`);
      return process.env[legacyName];
    }
  }
  return undefined;
}

function resolveNodeEnv() {
  if (process.env.NODE_ENV) return process.env.NODE_ENV;
  // MOOD=DEV was the original development switch.
  return process.env.MOOD === "DEV" ? "development" : "production";
}

const nodeEnv = resolveNodeEnv();

export const env = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === "production",
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || "bookstore",
  mongodbUri: read("MONGODB_URI"),
  bearerKey: process.env.BEARER_KEY,
  tokenSignature: process.env.TOKEN_SIGNATURE,
  emailToken: process.env.EMAIL_TOKEN,
  saltRounds: Number(process.env.SALT_ROUND),
  requireEmailConfirmation: process.env.REQUIRE_EMAIL_CONFIRMATION !== "false",
  frontendUrl: read("FRONTEND_URL")?.replace(/\/+$/, ""),
  cloudinary: Object.freeze({
    cloudName: read("CLOUDINARY_CLOUD_NAME"),
    apiKey: read("CLOUDINARY_API_KEY"),
    apiSecret: read("CLOUDINARY_API_SECRET"),
  }),
  stripe: Object.freeze({
    secretKey: read("STRIPE_SECRET_KEY"),
    webhookSecret: read("STRIPE_WEBHOOK_SECRET"),
  }),
  mail: Object.freeze({
    user: process.env.EMAIL,
    password: process.env.EMAIL_PASSWORD,
    fromName: process.env.MAIL_FROM_NAME || "Library",
    // "gmail" sends real email; "log" only logs (the default outside production).
    transport: process.env.MAIL_TRANSPORT || (nodeEnv === "production" ? "gmail" : "log"),
  }),
  // Browser origins allowed to call the API (comma-separated). Refresh cookies
  // still require a trusted Origin, even when the CORS list is unset.
  corsOrigins: process.env.CORS_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? null,
  // Files on disk: public covers (served at /uploads) and private documents.
  uploadDir: process.env.UPLOAD_DIR || path.join(apiRoot, "uploads"),
  // Optional catalogue assistant. Without a key it falls back to keyword search.
  assistant: Object.freeze({
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.ASSISTANT_MODEL || "claude-opus-5-5",
  }),
  worker: Object.freeze({
    // How often the worker runs its jobs (notifications, holds, reminders).
    intervalMs: Number(process.env.WORKER_INTERVAL_MS) || 60_000,
  }),
});

/**
 * Reports missing required variables and deprecated names in use.
 * Only variable names are reported, never their values.
 */
export function checkEnv() {
  const missing = REQUIRED_VARIABLES.filter((name) => !read(name));
  // .env.example ships "change-me..." placeholders; never run production with them.
  if (env.isProduction) {
    const placeholders = REQUIRED_VARIABLES.filter((name) => read(name)?.startsWith("change-me"));
    missing.push(...placeholders.map((name) => `${name} (still a .env.example placeholder)`));
  }
  if (process.env.SALT_ROUND && !Number.isInteger(env.saltRounds)) {
    missing.push("SALT_ROUND (must be an integer)");
  }
  return { missing, deprecated: [...new Set(deprecatedNamesInUse)] };
}
