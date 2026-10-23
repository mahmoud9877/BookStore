import { PaymentResponseDto } from "../dtos/finance.dto.js";
import { formatAmount } from "../policies/fine-policy.js";
import { pageOf, toSort } from "../../../core/pagination.js";
import { PAYMENT_OUTCOMES } from "../../orders/providers/payment-gateway.js";
import { NOTIFICATION_TYPES } from "../../settings/constants/library-settings.js";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../constants/finance-statuses.js";
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError, ensureFound } from "../../../core/http-errors.js";

const PAYMENT_POPULATE = [{ path: "member", select: "memberNumber name" }];
const S = PAYMENT_STATUSES;

/**
 * Payments of fines. Amounts always come from the fines on record, never from the
 * client; a payment's status is ours and changes only on verified events.
 */
export class PaymentService {
  #payments;
  #fines;
  #members;
  #settings;
  #gateway;
  #sequences;
  #notifications;
  #transactions;
  #audit;

  constructor({ paymentRepository, fineRepository, memberRepository, settingsService, paymentGateway, sequenceGenerator, notificationService, transactionRunner, auditService }) {
    this.#payments = paymentRepository;
    this.#fines = fineRepository;
    this.#members = memberRepository;
    this.#settings = settingsService;
    this.#gateway = paymentGateway;
    this.#sequences = sequenceGenerator;
    this.#notifications = notificationService;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  async list({ page, limit, sort, member, status, method, from, to }, actor) {
    const filter = { ...actor.branchFilter("branch") };
    if (member) filter.member = member;
    if (status) filter.status = status;
    if (method) filter.method = method;
    if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const result = await this.#payments.paginate(filter, { page, limit, sort: toSort(sort), populate: PAYMENT_POPULATE });
    return pageOf({ ...result, items: PaymentResponseDto.fromList(result.items) }, { page, limit });
  }

  async listOwn(userId) {
    const member = await this.#ownMember(userId);
    return PaymentResponseDto.fromList(await this.#payments.findMany({ member: member._id }, { sort: { createdAt: -1 }, limit: 200 }));
  }

  /**
   * Records cash taken at a desk and applies it to the member's outstanding
   * fines (the listed ones, else oldest first). The same idempotency key always
   * resolves the first payment instead of recording another.
   * @param {import("../dtos/finance.dto.js").RecordCashPaymentDto} dto
   */
  async recordCash({ member: memberId, amount, fines: fineIds, idempotencyKey }, actor) {
    if (idempotencyKey) {
      const previous = await this.#payments.findByIdempotencyKey(idempotencyKey);
      if (previous) return PaymentResponseDto.from(previous);
    }
    const member = ensureFound(await this.#members.findById(memberId), "Member not found");
    actor.assertBranch(member.homeBranch);
    const { currency } = await this.#settings.get();
    const receiptNumber = await this.#sequences.nextCode("receipt", "R", 8);

    const payment = await this.#transactions.run(async () => {
      const allocations = await this.#allocate(member._id, amount, fineIds);
      const created = await this.#payments.create({
        member: member._id, branch: member.homeBranch, method: PAYMENT_METHODS.cash, status: S.succeeded,
        currency, amount, allocations, receiptNumber, idempotencyKey, recordedBy: actor.userId, paidAt: new Date(),
      });
      await this.#applyAllocations(allocations);
      await this.#audit.record(actor, { action: "payment.record", entity: "Payment", entityId: created._id, branch: member.homeBranch, after: { amount, allocations, receiptNumber } });
      await this.#notifyReceived(member, created);
      return created;
    });
    return PaymentResponseDto.from(payment);
  }

  /**
   * Starts a card payment for the signed-in member's outstanding fines through
   * the provider's hosted checkout (card details never reach this API).
   * Resolves `{ payment, url }`.
   */
  async startCardCheckout(userId, { fines: fineIds }) {
    if (!this.#gateway.isConfigured) throw new ServiceUnavailableError("Card payments are not configured");
    const member = await this.#ownMember(userId);
    const outstanding = await this.#fines.listOutstanding(member._id, fineIds);
    const amount = outstanding.reduce((sum, fine) => sum + fine.amount - fine.paid - fine.waived, 0);
    if (amount <= 0) throw new BadRequestError("There is nothing to pay");
    const { currency } = await this.#settings.get();

    const payment = await this.#payments.create({
      member: member._id, branch: member.homeBranch, method: PAYMENT_METHODS.card, status: S.pending, currency, amount,
      allocations: outstanding.map((fine) => ({ fine: fine._id, amount: fine.amount - fine.paid - fine.waived })),
      provider: "stripe",
    });
    try {
      const session = await this.#gateway.createPaymentCheckout({
        reference: String(payment._id),
        description: `Library fines (${member.memberNumber})`,
        amount,
        currency,
        customerEmail: member.email,
        metadata: { kind: "fine_payment", paymentId: String(payment._id) },
        returnPath: "/account/fines",
      });
      await this.#payments.updateById(payment._id, { providerSessionId: session.id });
      return { payment: PaymentResponseDto.from(payment), url: session.url };
    } catch (error) {
      await this.#payments.transition(payment._id, S.pending, S.failed, { failureReason: "Could not start the checkout" });
      throw error;
    }
  }

  /**
   * Applies a verified provider outcome to a pending card payment, exactly once.
   * Fines paid meanwhile by other means are only charged what is still owed;
   * any excess stays on the payment (visible as unallocated) for a refund.
   */
  async applyProviderOutcome({ outcome, paymentId, paymentRef }) {
    if (!/^[a-f0-9]{24}$/i.test(String(paymentId))) return "ignored";
    return this.#transactions.run(async () => {
      const payment = await this.#payments.findById(paymentId);
      if (!payment || payment.status !== S.pending) return "ignored";
      if (outcome === PAYMENT_OUTCOMES.failed) {
        await this.#payments.transition(paymentId, S.pending, S.failed, { failureReason: "Declined or abandoned at checkout" });
        return "failed";
      }
      if (outcome !== PAYMENT_OUTCOMES.paid) return "ignored";

      const allocations = [];
      for (const planned of payment.allocations) {
        const fine = await this.#fines.findById(planned.fine);
        const due = fine ? Math.min(planned.amount, fine.amount - fine.paid - fine.waived) : 0;
        if (due > 0 && (await this.#fines.settle(fine._id, due))) allocations.push({ fine: fine._id, amount: due });
      }
      const receiptNumber = await this.#sequences.nextCode("receipt", "R", 8);
      const succeeded = await this.#payments.transition(paymentId, S.pending, S.succeeded, {
        allocations, receiptNumber, providerPaymentRef: paymentRef, paidAt: new Date(),
      });
      if (!succeeded) return "ignored";
      await this.#audit.record(null, { action: "payment.card_succeeded", entity: "Payment", entityId: paymentId, after: { amount: payment.amount, allocations } });
      const member = await this.#members.findById(payment.member);
      await this.#notifyReceived(member, succeeded);
      return "succeeded";
    });
  }

  /**
   * Refunds part or all of a payment (audited). Card refunds go through the
   * provider first; the refunded amount reopens the fines it had paid (most
   * recently allocated first).
   * @param {import("../dtos/finance.dto.js").RefundDto} dto
   */
  async refund({ id, amount, reason }, actor) {
    const payment = ensureFound(await this.#payments.findById(id), "Payment not found");
    if (payment.branch) actor.assertBranch(payment.branch);
    if (![S.succeeded, S.partiallyRefunded].includes(payment.status)) throw new BadRequestError("Only completed payments can be refunded");
    const refundable = payment.amount - payment.refundedAmount;
    if (amount > refundable) throw new BadRequestError(`At most ${refundable} can be refunded`);

    let providerRef;
    if (payment.method === PAYMENT_METHODS.card) {
      if (!payment.providerPaymentRef) throw new ConflictError("The provider reference for this payment is missing");
      providerRef = (await this.#gateway.refund({ paymentRef: payment.providerPaymentRef, amount, reference: `${id}:${payment.refunds.length + 1}` })).id;
    }

    const updated = await this.#transactions.run(async () => {
      const refundedAmount = payment.refundedAmount + amount;
      const result = await this.#payments.updateWhere(
        { _id: id, refundedAmount: payment.refundedAmount }, // nobody refunded meanwhile
        {
          $set: { refundedAmount, status: refundedAmount === payment.amount ? S.refunded : S.partiallyRefunded },
          $push: { refunds: { amount, reason, by: actor.userId, at: new Date(), providerRef } },
        }
      );
      if (!result) throw new ConflictError("The payment changed meanwhile. Reload and try again.");
      let remaining = amount;
      for (const allocation of [...payment.allocations].reverse()) {
        if (remaining <= 0) break;
        const reopen = Math.min(remaining, allocation.amount);
        if (await this.#fines.unsettle(allocation.fine, reopen)) remaining -= reopen;
      }
      await this.#audit.record(actor, {
        action: "payment.refund", entity: "Payment", entityId: id, branch: payment.branch,
        before: { refundedAmount: payment.refundedAmount, status: payment.status }, after: { refundedAmount, status: result.status }, reason,
      });
      return result;
    });
    return PaymentResponseDto.from(updated);
  }

  /** Splits `amount` over outstanding fines (listed ones, else oldest first); refuses overpayment. */
  async #allocate(memberId, amount, fineIds) {
    const outstanding = await this.#fines.listOutstanding(memberId, fineIds);
    const owed = outstanding.reduce((sum, fine) => sum + fine.amount - fine.paid - fine.waived, 0);
    if (owed === 0) throw new BadRequestError("The member has no outstanding fines");
    if (amount > owed) throw new BadRequestError(`The amount exceeds what is owed (${owed})`);
    const allocations = [];
    let remaining = amount;
    for (const fine of outstanding) {
      if (remaining === 0) break;
      const part = Math.min(remaining, fine.amount - fine.paid - fine.waived);
      allocations.push({ fine: fine._id, amount: part });
      remaining -= part;
    }
    return allocations;
  }

  async #applyAllocations(allocations) {
    for (const { fine, amount } of allocations) {
      if (!(await this.#fines.settle(fine, amount))) throw new ConflictError("A fine changed meanwhile. Reload and try again.");
    }
  }

  async #notifyReceived(member, payment) {
    await this.#notifications.notifyMember(
      member,
      NOTIFICATION_TYPES.paymentReceived,
      { amount: formatAmount(payment.amount, payment.currency), receiptNumber: payment.receiptNumber },
      String(payment._id)
    );
  }

  async #ownMember(userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    return member;
  }
}
