import { MEMBER_POPULATE } from "../repositories/member.repository.js";
import { CrudService } from "../../../core/crud-service.js";
import { pageOf, toSort } from "../../../core/pagination.js";
import { MemberPolicy, addMonths } from "../policies/member-policy.js";
import { MEMBER_STATUSES } from "../models/member.model.js";
import { MemberResponseDto, MembershipEventResponseDto, MembershipTypeResponseDto } from "../dtos/member.dto.js";
import { BadRequestError, ConflictError, NotFoundError, ensureFound } from "../../../core/http-errors.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";

const MEMBER_NOT_FOUND = "Member not found";

/** Library members: registration, details, renewal, suspension and their account summary. */
export class MemberService {
  #members;
  #types;
  #events;
  #users;
  #branches;
  #loans;
  #reservations;
  #fines;
  #sequences;
  #transactions;
  #audit;

  constructor({
    memberRepository, membershipTypeRepository, membershipEventRepository, userRepository, branchRepository,
    loanRepository, reservationRepository, fineRepository, sequenceGenerator, transactionRunner, auditService,
  }) {
    this.#members = memberRepository;
    this.#types = membershipTypeRepository;
    this.#events = membershipEventRepository;
    this.#users = userRepository;
    this.#branches = branchRepository;
    this.#loans = loanRepository;
    this.#reservations = reservationRepository;
    this.#fines = fineRepository;
    this.#sequences = sequenceGenerator;
    this.#transactions = transactionRunner;
    this.#audit = auditService;
  }

  /**
   * Staff whose role is limited to assigned branches see the members registered
   * at those branches (personal data stays with the branch that holds it).
   */
  async list({ page, limit, sort, search, status, kind, membershipType, homeBranch, expired }, actor) {
    const filter = { ...actor.branchFilter("homeBranch") };
    if (search) Object.assign(filter, this.#members.searchFilter(search));
    if (status) filter.status = status;
    if (kind) filter.kind = kind;
    if (membershipType) filter.membershipType = membershipType;
    if (homeBranch) filter.homeBranch = homeBranch;
    if (expired !== undefined) filter.expiresAt = expired ? { $lte: new Date() } : { $gt: new Date() };
    const result = await this.#members.paginate(filter, { page, limit, sort: toSort(sort), populate: MEMBER_POPULATE });
    return pageOf({ ...result, items: result.items.map((member) => this.#toDto(member)) }, { page, limit });
  }

  /** A member with their current loans/reservations/balance summary. */
  async get(id, actor) {
    const member = ensureFound(await this.#members.findWithType(id), MEMBER_NOT_FOUND);
    this.#assertCanSee(member, actor);
    return this.#toDto(member, await this.#summary(member._id));
  }

  /** Circulation desks look members up by number at any branch. */
  async getByNumber(memberNumber) {
    const member = ensureFound(await this.#members.findByNumber(memberNumber), MEMBER_NOT_FOUND);
    return this.#toDto(member, await this.#summary(member._id));
  }

  /** The signed-in user's own membership (self-service). */
  async getOwn(userId) {
    const member = await this.#members.findByUser(userId);
    if (!member) throw new NotFoundError("No library membership is linked to this account");
    return this.#toDto(member, await this.#summary(member._id));
  }

  /** @param {import("../dtos/member.dto.js").CreateMemberDto} dto */
  async register({ userEmail, ...data }, actor) {
    actor.assertBranch(data.homeBranch);
    const type = await this.#activeType(data.membershipType);
    ensureFound(await this.#branches.findById(data.homeBranch), "Branch not found");
    const user = userEmail ? await this.#linkableUser(userEmail) : null;
    const memberNumber = await this.#sequences.nextCode("member", "M", 7);

    const member = await this.#transactions.run(async () => {
      const created = await this.#members.create({
        ...data,
        memberNumber,
        user: user?._id ?? null,
        expiresAt: addMonths(new Date(), type.membershipMonths),
      });
      await this.#events.create({ member: created._id, type: "joined", actor: actor.userId, details: { membershipType: type.code } });
      await this.#audit.record(actor, { action: "member.register", entity: "Member", entityId: created._id, branch: created.homeBranch, after: { memberNumber, membershipType: type.code } });
      return created;
    });
    return this.get(member._id, actor);
  }

  /** @param {import("../dtos/member.dto.js").UpdateMemberDto} dto */
  async update({ id, userEmail, ...changes }, actor) {
    const member = ensureFound(await this.#members.findById(id), MEMBER_NOT_FOUND);
    actor.assertBranch(member.homeBranch);
    if (changes.homeBranch) {
      actor.assertBranch(changes.homeBranch);
      ensureFound(await this.#branches.findById(changes.homeBranch), "Branch not found");
    }
    const update = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined));
    if (changes.membershipType) await this.#activeType(changes.membershipType);
    if (userEmail !== undefined) update.user = userEmail ? (await this.#linkableUser(userEmail, id))._id : null;

    await this.#transactions.run(async () => {
      await this.#members.updateById(id, update);
      if (changes.membershipType && String(changes.membershipType) !== String(member.membershipType)) {
        await this.#events.create({ member: id, type: "type_changed", actor: actor.userId, details: { from: member.membershipType, to: changes.membershipType } });
      }
      await this.#audit.record(actor, { action: "member.update", entity: "Member", entityId: id, branch: member.homeBranch, before: member, after: update });
    });
    return this.get(id, actor);
  }

  /** Extends the membership by its type's period, from today or from the current expiry if later. */
  async renew({ id }, actor) {
    const member = ensureFound(await this.#members.findWithType(id), MEMBER_NOT_FOUND);
    actor.assertBranch(member.homeBranch._id);
    if (member.status === MEMBER_STATUSES.cancelled) throw new BadRequestError("A cancelled membership cannot be renewed");
    const from = new Date(Math.max(Date.now(), new Date(member.expiresAt).getTime()));
    const expiresAt = addMonths(from, member.membershipType.membershipMonths);
    await this.#transactions.run(async () => {
      await this.#members.updateById(id, { expiresAt });
      await this.#events.create({ member: id, type: "renewed", actor: actor.userId, details: { from: member.expiresAt, to: expiresAt } });
      await this.#audit.record(actor, { action: "member.renew", entity: "Member", entityId: id, branch: member.homeBranch._id, before: { expiresAt: member.expiresAt }, after: { expiresAt } });
    });
    return this.get(id, actor);
  }

  suspend({ id, reason }, actor) {
    return this.#changeStatus(id, MEMBER_STATUSES.suspended, reason, actor, [MEMBER_STATUSES.active]);
  }

  reactivate({ id, reason }, actor) {
    return this.#changeStatus(id, MEMBER_STATUSES.active, reason, actor, [MEMBER_STATUSES.suspended]);
  }

  /** Closing a membership requires that nothing is still out on loan. */
  async cancel({ id, reason }, actor) {
    if (await this.#loans.countWhere({ member: id, status: "active" })) {
      throw new ConflictError("The member still has items on loan");
    }
    return this.#changeStatus(id, MEMBER_STATUSES.cancelled, reason, actor, [MEMBER_STATUSES.active, MEMBER_STATUSES.suspended]);
  }

  async history(id, actor) {
    const member = ensureFound(await this.#members.findById(id), MEMBER_NOT_FOUND);
    this.#assertCanSee(member, actor);
    return MembershipEventResponseDto.fromList(await this.#events.listForMember(id));
  }

  async #changeStatus(id, status, reason, actor, from) {
    const member = ensureFound(await this.#members.findById(id), MEMBER_NOT_FOUND);
    actor.assertBranch(member.homeBranch);
    if (!from.includes(member.status)) throw new BadRequestError(`A ${member.status} membership cannot become ${status}`);
    await this.#transactions.run(async () => {
      const updated = await this.#members.updateWhere({ _id: id, status: member.status }, { status, statusReason: reason || null });
      if (!updated) throw new ConflictError("The member changed while you were editing. Reload and try again.");
      const eventType = { active: "reactivated", suspended: "suspended", cancelled: "cancelled" }[status];
      await this.#events.create({ member: id, type: eventType, actor: actor.userId, details: { reason } });
      await this.#audit.record(actor, { action: `member.${eventType}`, entity: "Member", entityId: id, branch: member.homeBranch, before: { status: member.status }, after: { status }, reason });
    });
    return this.get(id, actor);
  }

  async #summary(memberId) {
    const now = new Date();
    const [activeLoans, overdueLoans, activeReservations, balance] = await Promise.all([
      this.#loans.countWhere({ member: memberId, status: "active" }),
      this.#loans.countWhere({ member: memberId, status: "active", dueAt: { $lt: now } }),
      this.#reservations.countWhere({ member: memberId, status: { $in: ["waiting", "ready", "in_transit"] } }),
      this.#fines.outstandingBalance(memberId),
    ]);
    return { activeLoans, overdueLoans, activeReservations, balance };
  }

  #toDto(member, summary) {
    return MemberResponseDto.from({ ...member, isExpired: MemberPolicy.isExpired(member), summary });
  }

  #assertCanSee(member, actor) {
    // The desk may look up any member it serves; other staff only those of their branches.
    if (actor.can(PERMISSIONS.CirculationManage)) return;
    actor.assertBranch(member.homeBranch?._id ?? member.homeBranch);
  }

  async #activeType(typeId) {
    const type = ensureFound(await this.#types.findById(typeId), "Membership type not found");
    if (!type.isActive) throw new BadRequestError("This membership type is no longer offered");
    return type;
  }

  async #linkableUser(email, memberId) {
    const user = await this.#users.findByEmail(email.toLowerCase());
    if (!user) throw new BadRequestError("No account is registered with this email");
    const linked = await this.#members.findByUser(user._id);
    if (linked && String(linked._id) !== String(memberId)) throw new ConflictError("This account is already linked to another member");
    return user;
  }
}

/** Membership types are policy: managed with settings:manage. */
export class MembershipTypeService extends CrudService {
  static entity = "MembershipType";
  static searchFields = ["name", "code"];
  static Dto = MembershipTypeResponseDto;

  #members;

  constructor({ membershipTypeRepository, memberRepository, auditService }) {
    super({ repository: membershipTypeRepository, auditService });
    this.#members = memberRepository;
  }

  async beforeDelete(type) {
    if (await this.#members.countWhere({ membershipType: type._id })) {
      throw new ConflictError("Members still hold this membership type. Deactivate it instead.");
    }
  }
}
