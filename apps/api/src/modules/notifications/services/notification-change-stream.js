import { NOTIFICATION_CHANNELS, notificationModel } from "../models/notification.model.js";

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
// The resume token is too old (or otherwise unusable): start again from now.
const UNRESUMABLE_CODES = new Set([280, 286]);

/** New in-app notifications, and updates that set readAt. */
export const NOTIFICATION_CHANGES_PIPELINE = Object.freeze([
  {
    $match: {
      $or: [
        { operationType: "insert", "fullDocument.channel": NOTIFICATION_CHANNELS.inApp },
        { operationType: "update", "updateDescription.updatedFields.readAt": { $exists: true } },
      ],
    },
  },
]);

const watchNotifications = (pipeline, options) => notificationModel.watch(pipeline, options);

/**
 * ONE MongoDB change stream per process on the notifications collection, fed
 * into the NotificationHub. Errors are logged and the stream reopened with
 * backoff (resuming after the last event seen); it never throws.
 *
 * `notificationChangeSource(pipeline, options)` opens the stream (an
 * EventEmitter with `change`/`error`/`close` events and `close()`); tests
 * inject a fake.
 */
export class NotificationChangeStream {
  #hub;
  #watch;
  #stream = null;
  #resumeToken = null;
  #retryMs = MIN_RETRY_MS;
  #retryTimer = null;
  #running = false;

  constructor({ notificationHub, notificationChangeSource = watchNotifications }) {
    this.#hub = notificationHub;
    this.#watch = notificationChangeSource;
  }

  get isRunning() {
    return this.#running;
  }

  start() {
    if (this.#running) return;
    this.#running = true;
    this.#open();
  }

  async stop() {
    this.#running = false;
    clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    const stream = this.#stream;
    this.#stream = null;
    if (stream) await this.#closeQuietly(stream);
  }

  #open() {
    if (!this.#running) return;
    let stream;
    try {
      const options = { fullDocument: "updateLookup", ...(this.#resumeToken && { resumeAfter: this.#resumeToken }) };
      stream = this.#watch(NOTIFICATION_CHANGES_PIPELINE.map((stage) => ({ ...stage })), options);
    } catch (error) {
      this.#failed(null, error);
      return;
    }
    this.#stream = stream;
    stream.on("change", (change) => {
      this.#resumeToken = change._id ?? this.#resumeToken;
      this.#retryMs = MIN_RETRY_MS;
      try {
        this.#hub.handleChange(change);
      } catch (error) {
        console.error(`[notifications] change handling failed: ${error.message}`);
      }
    });
    stream.on("error", (error) => this.#failed(stream, error));
    stream.on("close", () => {
      if (this.#running && this.#stream === stream) this.#failed(stream, new Error("change stream closed"));
    });
  }

  #failed(stream, error) {
    if (stream && stream !== this.#stream) return; // an old stream we already replaced
    this.#stream = null;
    if (stream) this.#closeQuietly(stream);
    if (UNRESUMABLE_CODES.has(error?.code)) this.#resumeToken = null;
    if (!this.#running || this.#retryTimer) return;
    const delay = this.#retryMs;
    this.#retryMs = Math.min(this.#retryMs * 2, MAX_RETRY_MS);
    console.error(`[notifications] change stream error: ${error?.message}; retrying in ${delay / 1000}s`);
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.#open();
    }, delay);
    this.#retryTimer.unref?.();
  }

  async #closeQuietly(stream) {
    try {
      await stream.close();
    } catch {
      // already closed
    }
  }
}
