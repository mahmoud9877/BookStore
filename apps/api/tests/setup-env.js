// Loaded via `node --test --import` before any application module.
// Test-only placeholder values; nothing here is a real credential.
Object.assign(process.env, {
  DISABLE_DOTENV: "true",
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://127.0.0.1:1/bookstore-test",
  BEARER_KEY: "Test__",
  TOKEN_SIGNATURE: "test-token-signature",
  EMAIL_TOKEN: "test-email-token",
  SALT_ROUND: "4",
  STRIPE_SECRET_KEY: "sk_test_placeholder",
  STRIPE_WEBHOOK_SECRET: "whsec_test_placeholder",
  FRONTEND_URL: "http://localhost:8080",
});
