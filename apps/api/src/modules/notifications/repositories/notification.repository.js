import { notificationModel, DELIVERY_STATUSES, NOTIFICATION_CHANNELS } from "../models/notification.model.js";
import { BaseRepository } from "../../../core/base-repository.js";

export class NotificationRepository extends BaseRepository {
  constructor(model = notificationModel) {
    super(model);
  }

  /**
   * Inserts unless a notification with the same dedupe key exists. An upsert,
   * so a duplicate never aborts the surrounding transaction.
   */
  async createOnce(notification) {
    const existing = await this.updateWhere(
      { dedupeKey: notification.dedupeKey },
      { $setOnInsert: notification },
      { upsert: true, returnOriginal: true }
    );
    return existing === null;
  }

  /** Claims the next email due for delivery (lease-based, safe with several workers). */
  claimNextEmail(leaseMs) {
    const now = new Date();
    return this.updateWhere(
      {
        channel: NOTIFICATION_CHANNELS.email,
        $or: [
          { status: DELIVERY_STATUSES.pending, nextAttemptAt: { $lte: now } },
          { status: DELIVERY_STATUSES.sending, lockedUntil: { $lt: now } }, // a crashed worker's claim
        ],
      },
      { $set: { status: DELIVERY_STATUSES.sending, lockedUntil: new Date(now.getTime() + leaseMs) }, $inc: { attempts: 1 } }
    );
  }

  inboxFilter(userId, unreadOnly) {
    return { user: userId, channel: NOTIFICATION_CHANNELS.inApp, ...(unreadOnly && { readAt: null }) };
  }

  markRead(userId, ids) {
    const filter = { user: userId, channel: NOTIFICATION_CHANNELS.inApp, readAt: null };
    if (ids) filter._id = { $in: ids };
    return this.updateMany(filter, { $set: { readAt: new Date() } });
  }
}
