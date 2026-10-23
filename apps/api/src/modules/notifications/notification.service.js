import { pageOf } from "../../core/pagination.js";
import { DELIVERY_STATUSES, NOTIFICATION_CHANNELS } from "./notification.model.js";
import { SHOP_MESSAGES } from "./shop-notifications.js";

const MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;
const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);

/** Fills {{placeholders}}; unknown ones become empty. */
export const renderTemplate = (template, data) =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (data[key] == null ? "" : String(data[key])));

/** Plain text -> minimal HTML (escaped, paragraphs). */
const toHtml = (text) =>
  text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** Exponential backoff: 1, 2, 4, 8 minutes … */
const backoff = (attempts) => new Date(Date.now() + 60_000 * 2 ** Math.max(0, attempts - 1));

/**
 * Member notifications: an in-app inbox plus email, written as an outbox
 * (inside the caller's transaction) and delivered by the worker with retries.
 */
export class NotificationService {
  #notifications;
  #settings;
  #mailer;

  constructor({ notificationRepository, settingsService, mailer }) {
    this.#notifications = notificationRepository;
    this.#settings = settingsService;
    this.#mailer = mailer;
  }

  /**
   * Queues `type` for a member on every channel they can receive.
   * @param {{ _id, user?, email?, name }} member
   * @param {string} dedupeKey identifies the event, so it is never sent twice
   */
  async notifyMember(member, type, data, dedupeKey) {
    const settings = await this.#settings.get();
    const template = settings.notifications.templates[type];
    if (!template) throw new Error(`No notification template for ${type}`);
    const values = { memberName: member.name, ...data };
    const subject = renderTemplate(template.subject, values);
    const body = renderTemplate(template.body, values);
    const base = { member: member._id, user: member.user ?? null, type, subject, body, data: values };

    if (member.user) {
      await this.#notifications.createOnce({
        ...base,
        channel: NOTIFICATION_CHANNELS.inApp,
        status: DELIVERY_STATUSES.sent,
        sentAt: new Date(),
        dedupeKey: `${type}:${dedupeKey}:in_app`,
      });
    }
    const emailable = member.email && settings.notifications.emailEnabled;
    await this.#notifications.createOnce({
      ...base,
      channel: NOTIFICATION_CHANNELS.email,
      to: member.email || undefined,
      status: emailable ? DELIVERY_STATUSES.pending : DELIVERY_STATUSES.skipped,
      nextAttemptAt: new Date(),
      dedupeKey: `${type}:${dedupeKey}:email`,
    });
  }

  /**
   * In-app notification of `type` (see shop-notifications.js) for each user,
   * once per event and user: the stored key is `<type>:<dedupeKey>:<userId>`.
   * `subject`/`body` are English; clients translate from `type` + `data`.
   * Resolves the number of notifications created.
   */
  async notifyUsers(userIds, type, data, dedupeKey) {
    const message = SHOP_MESSAGES[type];
    if (!message) throw new Error(`No in-app message for ${type}`);
    const { subject, body } = message(data);
    const unique = [...new Set(userIds.map(String))];
    const created = await Promise.all(
      unique.map((userId) =>
        this.#notifications.createOnce({
          user: userId,
          type,
          channel: NOTIFICATION_CHANNELS.inApp,
          subject,
          body,
          data,
          status: DELIVERY_STATUSES.sent,
          sentAt: new Date(),
          dedupeKey: `${type}:${dedupeKey}:${userId}`,
        })
      )
    );
    return created.filter(Boolean).length;
  }

  /** Number of unread in-app notifications for a user. */
  unreadCount(userId) {
    return this.#notifications.countWhere(this.#notifications.inboxFilter(userId, true));
  }

  /**
   * Sends due emails (worker). Each claim is a lease, so several workers never
   * send the same message; failures retry with backoff up to MAX_ATTEMPTS.
   * Resolves `{ sent, failed }`.
   */
  async deliverPendingEmails(maxBatch = 50) {
    const result = { sent: 0, failed: 0 };
    for (let index = 0; index < maxBatch; index += 1) {
      const message = await this.#notifications.claimNextEmail(LEASE_MS);
      if (!message) break;
      let delivered = false;
      let error = null;
      try {
        delivered = await this.#mailer.send({ to: message.to, subject: message.subject, html: toHtml(message.body), text: message.body });
      } catch (sendError) {
        error = sendError.message;
      }
      if (delivered) {
        await this.#notifications.updateById(message._id, { status: DELIVERY_STATUSES.sent, sentAt: new Date(), lockedUntil: null });
        result.sent += 1;
      } else {
        const gaveUp = message.attempts >= MAX_ATTEMPTS;
        await this.#notifications.updateById(message._id, {
          status: gaveUp ? DELIVERY_STATUSES.failed : DELIVERY_STATUSES.pending,
          nextAttemptAt: backoff(message.attempts),
          lockedUntil: null,
          lastError: error ?? "The mail provider rejected the message",
        });
        result.failed += 1;
      }
    }
    return result;
  }

  async inbox(userId, { page, limit, unreadOnly }) {
    const filter = this.#notifications.inboxFilter(userId, unreadOnly);
    const result = await this.#notifications.paginate(filter, {
      page,
      limit,
      sort: { createdAt: -1, _id: -1 },
      select: "type subject body data readAt createdAt",
    });
    const unread = await this.unreadCount(userId);
    return { ...pageOf(result, { page, limit }), unread };
  }

  async markRead(userId, ids) {
    return { updated: await this.#notifications.markRead(userId, ids) };
  }

  /** Delivery overview for staff (status counts per channel). */
  async deliveryStats() {
    return this.#notifications.aggregate([
      { $group: { _id: { channel: "$channel", status: "$status" }, count: { $sum: 1 } } },
      { $project: { _id: 0, channel: "$_id.channel", status: "$_id.status", count: 1 } },
    ]);
  }
}
