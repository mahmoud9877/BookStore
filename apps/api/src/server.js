import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { env, checkEnv } from "./config/env.js";
import { MIGRATIONS } from "./migrations/index.js";
import { MigrationRunner } from "./migrations/runner.js";

const { missing, deprecated } = checkEnv();
if (deprecated.length) {
  console.warn(`Deprecated environment variable names in use: ${deprecated.join(", ")}`);
}
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const container = createContainer();
const app = createApp(container);

container.database
  .connect()
  .then(async () => {
    // Migrations run explicitly (npm run migrate); warn loudly if some are pending.
    const pending = await new MigrationRunner(MIGRATIONS, container).pending();
    if (pending.length) {
      console.warn(`${pending.length} database migration(s) pending — run "npm run migrate": ${pending.map((m) => m.id).join(", ")}`);
    }
  })
  .then(() => container.notificationChangeStream.start())
  .catch((error) => {
    console.error(`Error connecting to the database: ${error.message}`);
    process.exit(1);
  });

const server = app.listen(env.port, () => {
  console.log(`API listening on port ${env.port} (${env.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  // Open notification streams would otherwise keep server.close() waiting.
  container.notificationHub.closeAll();
  server.close(() => {
    container.notificationChangeStream
      .stop()
      .catch(() => {})
      .finally(() => container.database.disconnect().finally(() => process.exit(0)));
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Vercel's @vercel/node runtime (see vercel.json) uses the default export.
export default app;
