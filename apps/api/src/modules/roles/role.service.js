import { RoleResponseDto } from "./role.dto.js";
import { BRANCH_SCOPES, PERMISSION_CATALOGUE } from "./permissions.js";
import { SYSTEM_ROLES, findSystemRole } from "./system-roles.js";
import { ConflictError, ForbiddenError, ensureFound } from "../../core/http-errors.js";

const ROLE_NOT_FOUND = "Role not found";
const NO_ACCESS = Object.freeze({ permissions: Object.freeze([]), branchScope: BRANCH_SCOPES.assigned });

/** Roles, the permissions they grant and the branches those apply to. */
export class RoleService {
  #roles;
  #users;
  #audit;

  constructor({ roleRepository, userRepository, auditService }) {
    this.#roles = roleRepository;
    this.#users = userRepository;
    this.#audit = auditService;
  }

  listPermissions() {
    return PERMISSION_CATALOGUE;
  }

  /** Built-in roles first, then custom ones, each with how many accounts hold it. */
  async listRoles() {
    const [custom, counts] = await Promise.all([this.#roles.list(), this.#users.countByRole()]);
    const roles = [...SYSTEM_ROLES, ...custom.map((role) => ({ ...role, isSystem: false }))];
    return RoleResponseDto.fromList(roles.map((role) => ({ ...role, userCount: counts[role.name] ?? 0 })));
  }

  /**
   * `{ permissions, branchScope }` granted by a role name. Unknown roles (e.g. a
   * deleted one still on an old account) grant nothing. Built-in roles never
   * touch the database.
   */
  async accessFor(roleName) {
    const systemRole = findSystemRole(roleName);
    if (systemRole) return systemRole;
    const role = roleName ? await this.#roles.findByName(roleName) : null;
    return role ? { permissions: role.permissions, branchScope: role.branchScope ?? BRANCH_SCOPES.assigned } : NO_ACCESS;
  }

  async permissionsFor(roleName) {
    return (await this.accessFor(roleName)).permissions;
  }

  /**
   * Ids of the active accounts whose role grants `permission`: built-in roles
   * (Admin holds every permission) plus custom roles from the database.
   */
  async userIdsWithPermission(permission) {
    const custom = await this.#roles.namesGranting(permission);
    // Built-in role names are matched without case, like accessFor() does.
    const builtIn = SYSTEM_ROLES.filter((role) => role.permissions.includes(permission)).map(
      (role) => new RegExp(`^${role.name}$`, "i")
    );
    return this.#users.findActiveIdsByRoles([...builtIn, ...custom]);
  }

  /** Resolves true when `roleName` is a built-in or custom role. */
  async roleExists(roleName) {
    return Boolean(findSystemRole(roleName) || (await this.#roles.findByName(roleName)));
  }

  /**
   * @param {import("./role.dto.js").CreateRoleDto} dto
   * @param {{ role: string }} actor the signed-in user
   */
  async createRole({ name, description, permissions, branchScope }, actor) {
    if (await this.roleExists(name)) throw new ConflictError("A role with this name already exists");
    await this.assertCanGrant(actor, permissions, branchScope);
    const role = await this.#roles.create({ name, description, permissions, branchScope });
    await this.#audit.record(actor, { action: "role.create", entity: "Role", entityId: role._id, after: role });
    return RoleResponseDto.from({ ...role, isSystem: false, userCount: 0 });
  }

  /** @param {import("./role.dto.js").UpdateRoleDto} dto */
  async updateRole({ id, description, permissions, branchScope }, actor) {
    const current = ensureFound(await this.#roles.findById(id), ROLE_NOT_FOUND);
    // Changing a role also takes permissions away, so the actor must hold both sets.
    await this.assertCanGrant(actor, [...current.permissions, ...permissions], branchScope);
    if (current.branchScope === BRANCH_SCOPES.all) await this.assertCanGrant(actor, [], BRANCH_SCOPES.all);
    const role = ensureFound(
      await this.#roles.updateById(id, { description, permissions, branchScope }),
      ROLE_NOT_FOUND
    );
    await this.#audit.record(actor, { action: "role.update", entity: "Role", entityId: id, before: current, after: role });
    const userCount = (await this.#users.countByRole())[role.name] ?? 0;
    return RoleResponseDto.from({ ...role, isSystem: false, userCount });
  }

  async deleteRole(id, actor) {
    const role = ensureFound(await this.#roles.findById(id), ROLE_NOT_FOUND);
    await this.assertCanGrant(actor, role.permissions, role.branchScope);
    const userCount = (await this.#users.countByRole())[role.name] ?? 0;
    if (userCount > 0) {
      throw new ConflictError(`This role is assigned to ${userCount} account(s). Reassign them first.`);
    }
    await this.#roles.deleteById(id);
    await this.#audit.record(actor, { action: "role.delete", entity: "Role", entityId: id, before: role });
  }

  /**
   * Nobody can hand out (or take away) a permission they do not hold themselves,
   * nor grant access to every branch without having it, which stops privilege
   * escalation through roles.
   */
  async assertCanGrant(actor, permissions, branchScope = BRANCH_SCOPES.assigned) {
    const own = await this.accessFor(actor.role);
    const missing = permissions.filter((permission) => !own.permissions.includes(permission));
    if (missing.length) {
      throw new ForbiddenError(`You can't grant permissions you don't have: ${[...new Set(missing)].join(", ")}`);
    }
    if (branchScope === BRANCH_SCOPES.all && own.branchScope !== BRANCH_SCOPES.all) {
      throw new ForbiddenError("You can't grant access to every branch without having it");
    }
  }
}
