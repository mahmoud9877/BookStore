// Roles and permissions: the RoleService rules, role assignment, and the
// permission checks the AuthGuard applies to routes.
import { Types } from "mongoose";
import assert from "node:assert/strict";
import { describe, mock, test } from "node:test";
import { HttpError } from "../src/core/http-errors.js";
import { RoleService } from "../src/modules/roles/role.service.js";
import { UserService } from "../src/modules/users/user.service.js";
import { PERMISSIONS, ALL_PERMISSIONS } from "../src/modules/roles/permissions.js";
import { linkLegacyBookCategories } from "../src/modules/books/link-legacy-categories.js";
import { authenticateAs, expectValidationError, makeUser, useTestServer } from "./helpers.js";

const fake = (methods) =>
  Object.fromEntries(
    Object.entries(methods).map(([name, impl]) => [
      name,
      mock.fn(typeof impl === "function" ? impl : async () => impl),
    ])
  );

const rejectsWithStatus = (promise, status, message) =>
  assert.rejects(promise, (error) => {
    assert.ok(error instanceof HttpError, `expected HttpError, got ${error}`);
    assert.equal(error.status, status);
    if (message) assert.match(error.message, message);
    return true;
  });

const editor = { _id: "editor", name: "Editor", permissions: [PERMISSIONS.BooksManage, PERMISSIONS.RolesManage] };

const makeRoleService = ({ roles = {}, users = {} } = {}) => {
  const roleRepository = fake({
    list: [],
    findByName: async (name) => (name === editor.name ? editor : null),
    findById: editor,
    create: async (data) => ({ _id: "new", ...data }),
    updateById: async (id, data) => ({ ...editor, ...data }),
    deleteById: {},
    ...roles,
  });
  const userRepository = fake({ countByRole: {}, ...users });
  const auditService = fake({ record: {} });
  return { service: new RoleService({ roleRepository, userRepository, auditService }), roleRepository, userRepository, auditService };
};

describe("RoleService", () => {
  test("built-in roles resolve without the database: Admin has everything, User nothing", async () => {
    const { service, roleRepository } = makeRoleService();
    assert.deepEqual([...(await service.permissionsFor("Admin"))], ALL_PERMISSIONS);
    assert.deepEqual([...(await service.permissionsFor("User"))], []);
    assert.equal(roleRepository.findByName.mock.callCount(), 0);
  });

  test("custom roles grant their stored permissions; unknown roles grant none", async () => {
    const { service } = makeRoleService();
    assert.deepEqual(await service.permissionsFor("Editor"), editor.permissions);
    assert.deepEqual([...(await service.permissionsFor("Deleted role"))], []);
  });

  test("listRoles puts built-in roles first and counts accounts per role", async () => {
    const { service } = makeRoleService({
      roles: { list: [editor] },
      users: { countByRole: { Admin: 1, User: 7, Editor: 2 } },
    });
    const roles = (await service.listRoles()).map(({ name, isSystem, userCount }) => [name, isSystem, userCount]);
    assert.deepEqual(roles, [
      ["Admin", true, 1],
      ["User", true, 7],
      ["Editor", false, 2],
    ]);
  });

  test("role names must not clash with built-in or existing roles", async () => {
    const { service } = makeRoleService();
    const admin = { role: "Admin" };
    await rejectsWithStatus(service.createRole({ name: "admin", permissions: [] }, admin), 409);
    await rejectsWithStatus(service.createRole({ name: "Editor", permissions: [] }, admin), 409);
  });

  test("nobody can grant a permission they do not hold", async () => {
    const { service, roleRepository } = makeRoleService();
    const actor = { role: "Editor" };
    await rejectsWithStatus(
      service.createRole({ name: "Support", permissions: [PERMISSIONS.UsersManage] }, actor),
      403,
      /users:manage/
    );
    assert.equal(roleRepository.create.mock.callCount(), 0);

    const created = await service.createRole({ name: "Writer", permissions: [PERMISSIONS.BooksManage] }, actor);
    assert.equal(created.name, "Writer");
  });

  test("updating a role also requires holding the permissions it takes away", async () => {
    const { service } = makeRoleService({
      roles: { findById: { ...editor, permissions: [PERMISSIONS.UsersManage] } },
    });
    await rejectsWithStatus(service.updateRole({ id: "r1", permissions: [] }, { role: "Editor" }), 403);
    await service.updateRole({ id: "r1", permissions: [] }, { role: "Admin" });
  });

  test("a role still assigned to accounts cannot be deleted", async () => {
    const { service, roleRepository } = makeRoleService({ users: { countByRole: { Editor: 3 } } });
    await rejectsWithStatus(service.deleteRole("r1", { role: "Admin" }), 409, /3 account/);
    assert.equal(roleRepository.deleteById.mock.callCount(), 0);
  });
});

describe("UserService.changeRole", () => {
  const makeService = (target = { _id: "u2", role: "User" }) => {
    const { service: roleService } = makeRoleService();
    const userRepository = fake({ findById: target, updateRole: async (id, role) => ({ ...target, role }) });
    const auditService = fake({ record: {} });
    return { service: new UserService({ userRepository, roleService, auditService }), userRepository, auditService };
  };

  test("assigns an existing role", async () => {
    const { service } = makeService();
    const user = await service.changeRole({ id: "u2", role: "Editor" }, { _id: "u1", role: "Admin" });
    assert.equal(user.role, "Editor");
  });

  test("refuses unknown roles and changing your own role", async () => {
    const { service } = makeService();
    await rejectsWithStatus(service.changeRole({ id: "u2", role: "Ghost" }, { _id: "u1", role: "Admin" }), 404);
    await rejectsWithStatus(service.changeRole({ id: "u1", role: "User" }, { _id: "u1", role: "Admin" }), 400);
  });

  test("cannot promote to, or demote from, a role with more permissions than your own", async () => {
    const actor = { _id: "u1", role: "Editor" };
    await rejectsWithStatus(makeService().service.changeRole({ id: "u2", role: "Admin" }, actor), 403);
    const { service, userRepository } = makeService({ _id: "u2", role: "Admin" });
    await rejectsWithStatus(service.changeRole({ id: "u2", role: "User" }, actor), 403);
    assert.equal(userRepository.updateRole.mock.callCount(), 0);
  });
});

describe("permission checks on routes", () => {
  const server = useTestServer();
  const categoryId = "507f1f77bcf86cd799439011";

  const asCustomRole = (t, permissions) => {
    t.mock.method(server.container.roleRepository, "findByName", async () => ({ name: "Staff", permissions }));
    return authenticateAs(t, server.container, makeUser("Staff"));
  };

  test("a custom role reaches exactly the routes its permissions allow", async (t) => {
    const headers = asCustomRole(t, [PERMISSIONS.CategoriesManage]);
    expectValidationError(await server.request("POST", "/category", { headers }));
    assert.equal((await server.request("POST", "/book/add", { headers })).status, 403);
    assert.equal((await server.request("GET", "/auth/user", { headers })).status, 403);
    assert.equal((await server.request("GET", "/role", { headers })).status, 403);
  });

  test("regular users cannot manage roles or change account roles", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("User"));
    for (const [method, path] of [
      ["GET", "/role"],
      ["POST", "/role"],
      ["DELETE", `/role/${categoryId}`],
      ["PATCH", `/auth/user/${categoryId}/role`],
      ["PATCH", `/order/${categoryId}/delivered`],
    ]) {
      assert.equal((await server.request(method, path, { headers })).status, 403, `${method} ${path}`);
    }
  });

  test("GET /role/permissions lists the permission catalogue for admins", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    const res = await server.request("GET", "/role/permissions", { headers });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.permissions.map(({ key }) => key).sort(), [...ALL_PERMISSIONS].sort());
  });

  test("POST /role validates permission names", async (t) => {
    const headers = authenticateAs(t, server.container, makeUser("Admin"));
    expectValidationError(
      await server.request("POST", "/role", { headers, body: { name: "Staff", permissions: ["everything"] } })
    );
  });

  test("GET /auth/me returns the signed-in account with its permissions", async (t) => {
    const user = makeUser("Staff");
    const headers = asCustomRole(t, [PERMISSIONS.UsersRead]);
    t.mock.method(server.container.userRepository, "findByIdWithoutSecrets", async () => ({ ...user, password: "x" }));
    t.mock.method(server.container.memberRepository, "findByUser", async () => null);
    const res = await server.request("GET", "/auth/me", { headers });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.user.permissions, [PERMISSIONS.UsersRead]);
    assert.equal("password" in res.json.user, false);
  });
});

describe("linkLegacyBookCategories", () => {
  test("replaces category names with ids, creating categories that are missing", async () => {
    const fiction = { _id: new Types.ObjectId(), name: "fiction" };
    const books = [
      { _id: "b1", category: "Fiction" },
      { _id: "b2", category: "fiction" },
      { _id: "b3", category: "poetry" },
    ];
    const bookRepository = fake({ findWithLegacyCategory: books, setCategories: {} });
    const categoryRepository = fake({
      findByName: async (name) => (name === "fiction" ? fiction : null),
      create: async ({ name }) => ({ _id: "new-poetry", name }),
    });

    assert.equal(await linkLegacyBookCategories({ bookRepository, categoryRepository }), 3);
    assert.deepEqual(bookRepository.setCategories.mock.calls[0].arguments[0], [
      { bookId: "b1", categoryId: fiction._id },
      { bookId: "b2", categoryId: fiction._id },
      { bookId: "b3", categoryId: "new-poetry" },
    ]);
    assert.equal(categoryRepository.create.mock.callCount(), 1);
  });

  test("does nothing once every book references its category", async () => {
    const bookRepository = fake({ findWithLegacyCategory: [], setCategories: {} });
    assert.equal(await linkLegacyBookCategories({ bookRepository, categoryRepository: fake({}) }), 0);
    assert.equal(bookRepository.setCategories.mock.callCount(), 0);
  });
});
