import { NOTIFICATION_CHANNELS } from "./notification.model.js";

/** Read-marking updates many rows at once; their unread recounts are coalesced per user. */
const UNREAD_COALESCE_MS = 50;

/** What a live client receives about a new notification. */
const toEvent = (notification) => ({
  _id: String(notification._id),
  type: notification.type,
  subject: notification.subject,
  body: notification.body,
  data: notification.data ?? {},
  createdAt: notification.createdAt,
  readAt: notification.readAt ?? null,
});

/**
 * In-memory fan-out of notification changes to the users' open streams in this
 * process. Fed by NotificationChangeStream (one per process), so it also sees
 * notifications written by the worker or by other API instances.
 *
 * A subscriber is `{ send(event, data), close() }`.
 */
export class NotificationHub {
  #notifications;
  #subscribers = new Map(); // userId -> Set<subscriber>
  #pendingUnread = new Map(); // userId -> timer

  constructor({ notificationService }) {
    this.#notifications = notificationService;
  }

  /** Registers a user's stream; returns an `unsubscribe` function. */
  subscribe(userId, subscriber) {
    const key = String(userId);
    if (!this.#subscribers.has(key)) this.#subscribers.set(key, new Set());
    this.#subscribers.get(key).add(subscriber);
    return () => {
      const set = this.#subscribers.get(key);
      if (!set) return;
      set.delete(subscriber);
      if (!set.size) this.#subscribers.delete(key);
    };
  }

  /** Number of open streams (for one user, or in total). */
  connections(userId) {
    if (userId !== undefined) return this.#subscribers.get(String(userId))?.size ?? 0;
    let total = 0;
    for (const set of this.#subscribers.values()) total += set.size;
    return total;
  }

  unreadCount(userId) {
    return this.#notifications.unreadCount(userId);
  }

  /**
   * Applies one MongoDB change event on the notifications collection: a new
   * in-app notification is pushed to its user (then the unread count); a
   * read-marking only refreshes the unread count.
   */
  handleChange(change) {
    const doc = change.fullDocument;
    if (!doc?.user || doc.channel !== NOTIFICATION_CHANNELS.inApp) return;
    const userId = String(doc.user);
    if (!this.#subscribers.has(userId)) return;
    if (change.operationType === "insert") {
      this.#broadcast(userId, "notification", toEvent(doc));
    }
    this.#scheduleUnread(userId);
  }

  /** Ends every open stream (shutdown). */
  closeAll() {
    for (const timer of this.#pendingUnread.values()) clearTimeout(timer);
    this.#pendingUnread.clear();
    for (const set of this.#subscribers.values()) {
      for (const subscriber of set) {
        try {
          subscriber.close();
        } catch {
          // already gone
        }
      }
    }
    this.#subscribers.clear();
  }

  #scheduleUnread(userId) {
    if (this.#pendingUnread.has(userId)) return;
    const timer = setTimeout(async () => {
      this.#pendingUnread.delete(userId);
      if (!this.#subscribers.has(userId)) return;
      try {
        const unread = await this.#notifications.unreadCount(userId);
        this.#broadcast(userId, "unread", { unread });
      } catch (error) {
        console.error(`[notifications] unread count failed: ${error.message}`);
      }
    }, UNREAD_COALESCE_MS);
    timer.unref?.();
    this.#pendingUnread.set(userId, timer);
  }

  #broadcast(userId, event, data) {
    for (const subscriber of this.#subscribers.get(userId) ?? []) {
      try {
        subscriber.send(event, data);
      } catch (error) {
        console.error(`[notifications] stream write failed: ${error.message}`);
      }
    }
  }
}
