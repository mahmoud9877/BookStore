import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";

// env.js reads process.env once at import time, so each case runs in a fresh process.
function loadEnv(variables) {
  const script = `
    const { env, checkEnv } = await import("./src/config/env.js");
    console.log(JSON.stringify({ env, check: checkEnv() }));
  `;
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: new URL("..", import.meta.url),
    env: { PATH: process.env.PATH, DISABLE_DOTENV: "true", ...variables },
  });
  return JSON.parse(output.toString().trim().split("\n").pop());
}

test("reports missing required variables by name only", () => {
  const { check } = loadEnv({ BEARER_KEY: "x" });
  assert.deepEqual(check.missing, ["MONGODB_URI", "TOKEN_SIGNATURE", "EMAIL_TOKEN", "SALT_ROUND"]);
});

test("accepts legacy variable names and reports them as deprecated", () => {
  const { env, check } = loadEnv({
    DB_LOCAL: "mongodb://legacy",
    Secret_Key: "sk_legacy",
    endpointSecret: "whsec_legacy",
    API_KEY: "cloud-key",
    FE_URL: "https://shop.example/",
    MOOD: "DEV",
  });
  assert.equal(env.mongodbUri, "mongodb://legacy");
  assert.equal(env.stripe.secretKey, "sk_legacy");
  assert.equal(env.stripe.webhookSecret, "whsec_legacy");
  assert.equal(env.cloudinary.apiKey, "cloud-key");
  assert.equal(env.frontendUrl, "https://shop.example");
  assert.equal(env.nodeEnv, "development");
  assert.ok(check.deprecated.includes("DB_LOCAL (use MONGODB_URI)"));
});

test("canonical names take precedence over legacy names", () => {
  const { env } = loadEnv({ MONGODB_URI: "mongodb://new", DB_LOCAL: "mongodb://old" });
  assert.equal(env.mongodbUri, "mongodb://new");
});

test("defaults to production when NODE_ENV and MOOD are unset", () => {
  const { env } = loadEnv({});
  assert.equal(env.isProduction, true);
  assert.equal(env.requireEmailConfirmation, true);
});

test("rejects .env.example placeholders in production only", () => {
  const placeholders = {
    MONGODB_URI: "mongodb://mongo:27017/bookstore",
    BEARER_KEY: "change-me-bearer-prefix__",
    TOKEN_SIGNATURE: "change-me-token-signature",
    EMAIL_TOKEN: "x",
    SALT_ROUND: "8",
  };
  assert.deepEqual(loadEnv({ ...placeholders, NODE_ENV: "production" }).check.missing, [
    "BEARER_KEY (still a .env.example placeholder)",
    "TOKEN_SIGNATURE (still a .env.example placeholder)",
  ]);
  assert.deepEqual(loadEnv({ ...placeholders, NODE_ENV: "development" }).check.missing, []);
});
