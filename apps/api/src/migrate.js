// Database migrations: `npm run migrate` (apply pending) or `npm run migrate:status`.
// Run explicitly as part of a deployment, never implicitly at API start.
import { createContainer } from "./container.js";
import { checkEnv } from "./config/env.js";
import { MIGRATIONS } from "./migrations/index.js";
import { MigrationRunner } from "./migrations/runner.js";

const command = process.argv[2] ?? "up";
const { missing } = checkEnv();
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const container = createContainer();
await container.database.connect();
const runner = new MigrationRunner(MIGRATIONS, container);
try {
  if (command === "status") {
    for (const { id, appliedAt } of await runner.status()) console.log(`${appliedAt ? "applied" : "PENDING"}  ${id}`);
  } else if (command === "up") {
    const applied = await runner.up();
    console.log(applied.length ? `Applied ${applied.length} migration(s).` : "Nothing to apply.");
  } else {
    console.error(`Unknown command: ${command} (use "up" or "status")`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await container.database.disconnect();
}
