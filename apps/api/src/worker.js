// Background worker: delivers queued emails and runs scheduled library jobs.
// Runs as its own process (`npm run worker`, the `worker` Docker service), so
// slow email providers never hold up API requests. Safe to run several copies.
import { checkEnv, env } from "./config/env.js";
import { createContainer } from "./container.js";
import { SYSTEM_ACCESS } from "./core/access-context.js";
import { JobScheduler } from "./infrastructure/job-scheduler.js";

const MINUTE = 60_000;

export function createScheduler(container) {
  const { notificationService, reminderService, reservationService } = container;
  return new JobScheduler()
    .add("deliver-emails", MINUTE, () => notificationService.deliverPendingEmails())
    .add("expire-holds", 15 * MINUTE, async () => ({ expired: await reservationService.expireOverdueHolds(SYSTEM_ACCESS) }))
    .add("due-soon-reminders", 60 * MINUTE, async () => ({ queued: await reminderService.dueSoon() }))
    .add("overdue-notices", 6 * 60 * MINUTE, async () => ({ queued: await reminderService.overdue() }))
    .add("membership-expiry-reminders", 24 * 60 * MINUTE, async () => ({ queued: await reminderService.membershipsExpiring() }));
}

async function main() {
  const { missing } = checkEnv();
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
  const container = createContainer();
  if (env.mail.transport === "gmail" && !container.mailer.isConfigured) {
    console.warn("[worker] MAIL_TRANSPORT=gmail but EMAIL/EMAIL_PASSWORD are not set: emails will fail and be retried.");
  }
  await container.database.connect();
  const scheduler = createScheduler(container);
  let stopping = false;
  let timer;

  const loop = async () => {
    if (stopping) return;
    try {
      await scheduler.tick();
    } catch (error) {
      console.error(`[worker] tick failed: ${error.message}`);
    }
    if (!stopping) timer = setTimeout(loop, env.worker.intervalMs);
  };

  const shutdown = (signal) => {
    console.log(`[worker] ${signal} received, stopping.`);
    stopping = true;
    clearTimeout(timer);
    container.database.disconnect().finally(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(`[worker] started (every ${env.worker.intervalMs / 1000}s, mail: ${env.mail.transport})`);
  await loop();
}

if (process.argv[1]?.endsWith("worker.js")) await main();
