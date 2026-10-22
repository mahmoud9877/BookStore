// Integration tests need a real MongoDB replica set (transactions). They run
// inside the dev API container:
//   docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api npm run test:integration
// The database name must end in "_test"; it is dropped before the run.
const uri = process.env.MONGODB_TEST_URI ?? "mongodb://mongo:27017/library_test?replicaSet=rs0";
const name = new URL(uri).pathname.slice(1);
if (!name.endsWith("_test")) {
  throw new Error(`Refusing to run integration tests against "${name}": the database name must end in _test`);
}

Object.assign(process.env, {
  DISABLE_DOTENV: "true",
  NODE_ENV: "test",
  MONGODB_URI: uri,
  BEARER_KEY: "Test__",
  TOKEN_SIGNATURE: "test-token-signature",
  EMAIL_TOKEN: "test-email-token",
  SALT_ROUND: "4",
  MAIL_TRANSPORT: "log",
  UPLOAD_DIR: "/tmp/library-test-uploads",
  FRONTEND_URL: "http://localhost:3000",
  ANTHROPIC_API_KEY: "",
});
