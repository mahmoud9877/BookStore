import { COPY_STATUSES } from "../../copies/constants/copy-statuses.js";
import { RESERVATION_STATUSES } from "../constants/circulation-statuses.js";
import { TRANSFER_REASONS, TRANSFER_STATUSES } from "../../transfers/models/transfer.model.js";
import { NOTIFICATION_TYPES } from "../../settings/constants/library-settings.js";
import { ConflictError } from "../../../core/http-errors.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const S = COPY_STATUSES;
const R = RESERVATION_STATUSES;

/**
 * Decides where a copy goes when it becomes free (returned, a hold cancelled or
 * expired, a transfer received) and applies it. Must run inside a transaction.
 *
 * Order of preference:
 *   1. the oldest reservation collecting at the branch where the copy is,
 *   2. else the oldest reservation anywhere (if cross-branch pickup is allowed),
 *      by sending the copy there,
 *   3. else back on the shelf: at its own branch, or sent home first (if
 *      `returnToHomeBranch`), or re-homed where it is.
 */
export class CopyAllocator {
  #copies;
  #reservations;
  #transfers;
  #branches;
  #books;
  #members;
  #settings;
  #notifications;

  constructor({ copyRepository, reservationRepository, transferRepository, branchRepository, bookRepository, memberRepository, settingsService, notificationService }) {
    this.#copies = copyRepository;
    this.#reservations = reservationRepository;
    this.#transfers = transferRepository;
    this.#branches = branchRepository;
    this.#books = bookRepository;
    this.#members = memberRepository;
    this.#settings = settingsService;
    this.#notifications = notificationService;
  }

  /**
   * @param {object} copy the copy as it is now (any status)
   * @param {unknown} atBranch the branch where the copy physically is
   * @param {{ userId?: unknown }} actor
   * Resolves a short description of what happened ("held", "transfer", "shelved").
   */
  async release(copy, atBranch, actor) {
    const settings = await this.#settings.get();
    const next = await this.#reservations.nextWaiting(copy.book, atBranch, settings.reservations.allowCrossBranchPickup);
    if (next) {
      if (String(next.pickupBranch) === String(atBranch)) {
        await this.hold(copy, next, actor);
        return "held";
      }
      await this.#send(copy, atBranch, next.pickupBranch, TRANSFER_REASONS.reservation, actor, next);
      return "transfer";
    }
    if (String(copy.branch) === String(atBranch)) {
      await this.#move(copy, S.available, { reservation: null, transfer: null });
      return "shelved";
    }
    if (settings.circulation.returnToHomeBranch) {
      await this.#send(copy, atBranch, copy.branch, TRANSFER_REASONS.returnHome, actor);
      return "transfer";
    }
    await this.#move(copy, S.available, { branch: atBranch, location: null, reservation: null, transfer: null });
    return "shelved";
  }

  /** Puts `copy` aside for a reservation at its pickup branch and tells the member. */
  async hold(copy, reservation, actor) {
    const settings = await this.#settings.get();
    const readyAt = new Date();
    const expiresAt = new Date(readyAt.getTime() + settings.reservations.holdPickupDays * DAY_MS);
    await this.#move(copy, S.onHold, { reservation: reservation._id, transfer: null });
    const ready = await this.#reservations.transition(reservation._id, [R.waiting, R.inTransit], R.ready, {
      copy: copy._id,
      readyAt,
      expiresAt,
    });
    if (!ready) throw new ConflictError("The reservation changed meanwhile. Please retry.");

    const [member, book, branch] = await Promise.all([
      this.#members.findById(reservation.member),
      this.#books.findById(reservation.book),
      this.#branches.findById(reservation.pickupBranch),
    ]);
    await this.#notifications.notifyMember(
      member,
      NOTIFICATION_TYPES.reservationReady,
      { title: book?.bookTitle, branchName: branch?.name, expiresAt: expiresAt.toDateString() },
      `${reservation._id}:${readyAt.toISOString()}`
    );
    return ready;
  }

  async #send(copy, fromBranch, toBranch, reason, actor, reservation = null) {
    const transfer = await this.#transfers.create({
      copy: copy._id,
      book: copy.book,
      fromBranch,
      toBranch,
      status: TRANSFER_STATUSES.inTransit,
      reason,
      reservation: reservation?._id ?? null,
      history: [{ status: TRANSFER_STATUSES.inTransit, at: new Date(), by: actor?.userId ?? null, note: "Sent automatically" }],
    });
    await this.#move(copy, S.inTransit, { transfer: transfer._id, reservation: reservation?._id ?? null });
    if (reservation) {
      const moved = await this.#reservations.transition(reservation._id, R.waiting, R.inTransit, { copy: copy._id });
      if (!moved) throw new ConflictError("The reservation changed meanwhile. Please retry.");
    }
    return transfer;
  }

  async #move(copy, status, fields) {
    const moved = await this.#copies.transition(copy._id, copy.status, status, fields);
    if (!moved) throw new ConflictError("The copy changed meanwhile. Please retry.");
    return moved;
  }
}
