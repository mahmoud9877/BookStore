import { CurrentUserResponseDto, UserResponseDto } from "../dtos/user.dto.js";
import { BadRequestError, NotFoundError, ensureFound } from "../../../core/http-errors.js";
import { BRANCH_SCOPES } from "../../roles/constants/permissions.js";

const USER_NOT_FOUND = "User not found";

/** User account administration. */
export class UserService {
  #users;
  #roles;
  #branches;
  #members;
  #audit;

  constructor({ userRepository, roleService, branchRepository, memberRepository, auditService }) {
    this.#users = userRepository;
    this.#roles = roleService;
    this.#branches = branchRepository;
    this.#members = memberRepository;
    this.#audit = auditService;
  }

  /** @param {import("../dtos/user.dto.js").ListUsersDto} query */
  async listUsers(query = {}) {
    const { items, total } = await this.#users.listWithoutSecrets(query);
    const { page = 1, limit = 50 } = query;
    return { users: UserResponseDto.fromList(items), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getCurrentUser(userId) {
    const user = ensureFound(await this.#users.findByIdWithoutSecrets(userId), USER_NOT_FOUND);
    const [{ permissions, branchScope }, member] = await Promise.all([
      this.#roles.accessFor(user.role),
      this.#members.findByUser(userId),
    ]);
    return CurrentUserResponseDto.from({ ...user, permissions, branchScope, memberId: member?._id ?? null });
  }

  /**
   * @param {import("../dtos/user.dto.js").ChangeUserRoleDto} dto
   * @param {import("../../../core/access-context.js").AccessContext} actor
   */
  async changeRole({ id, role }, actor) {
    // Also guarantees an Admin always remains: only Admins can demote an Admin,
    // and never themselves.
    this.#assertNotSelf(actor, id, "You can't change your own role");
    if (!(await this.#roles.roleExists(role))) throw new NotFoundError("Role not found");
    const target = ensureFound(await this.#users.findById(id), USER_NOT_FOUND);

    const [current, next] = await Promise.all([this.#roles.accessFor(target.role), this.#roles.accessFor(role)]);
    await this.#roles.assertCanGrant(actor, [...current.permissions, ...next.permissions], next.branchScope);
    if (current.branchScope === BRANCH_SCOPES.all) await this.#roles.assertCanGrant(actor, [], BRANCH_SCOPES.all);

    const user = ensureFound(await this.#users.updateRole(id, role), USER_NOT_FOUND);
    await this.#audit.record(actor, {
      action: "user.role_change",
      entity: "User",
      entityId: id,
      before: { role: target.role },
      after: { role },
    });
    return UserResponseDto.from(user);
  }

  /**
   * Assigns branches and/or (de)activates an account. Staff can only assign
   * branches they can access themselves.
   * @param {import("../dtos/user.dto.js").UpdateUserAccessDto} dto
   */
  async updateAccess({ id, branches, isActive }, actor) {
    this.#assertNotSelf(actor, id, "You can't change your own access");
    const target = ensureFound(await this.#users.findById(id), USER_NOT_FOUND);
    const targetAccess = await this.#roles.accessFor(target.role);
    await this.#roles.assertCanGrant(actor, targetAccess.permissions, targetAccess.branchScope);

    const update = {};
    if (branches) {
      const found = await this.#branches.countWhere({ _id: { $in: branches } });
      if (found !== branches.length) throw new BadRequestError("Unknown branch");
      // Adding or removing a branch the actor cannot access is not allowed.
      const previous = (target.branches ?? []).map(String);
      const changed = [
        ...branches.filter((branchId) => !previous.includes(branchId)),
        ...previous.filter((branchId) => !branches.includes(branchId)),
      ];
      changed.forEach((branchId) => actor.assertBranch(branchId, "You can only assign branches you are assigned to"));
      update.branches = branches;
    }
    if (isActive !== undefined) update.isActive = isActive;

    const user = ensureFound(await this.#users.updateAccess(id, update), USER_NOT_FOUND);
    await this.#audit.record(actor, {
      action: "user.access_change",
      entity: "User",
      entityId: id,
      before: { branches: target.branches, isActive: target.isActive ?? true },
      after: update,
    });
    return UserResponseDto.from(user);
  }

  #assertNotSelf(actor, id, message) {
    if (String(actor.userId ?? actor._id) === String(id)) throw new BadRequestError(message);
  }
}
