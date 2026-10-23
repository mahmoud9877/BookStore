import { Types } from "mongoose";
import assert from "node:assert/strict";
import { after, before } from "node:test";
import { createApp } from "../src/app.js";
import { createContainer } from "../src/container.js";

/** An OrderNotifier that does nothing (HTTP tests have no database to write notifications to). */
export const silentOrderNotifier = () =>
  Object.fromEntries(
    ["orderPlaced", "paymentConfirmed", "paymentFailed", "delivered", "cancelled", "stockTaken"].map((name) => [name, async () => {}])
  );

/**
 * Starts the app on an ephemeral port with a fresh container (`overrides` as in
 * createContainer; order notifications are silenced unless overridden).
 * Returns `{ request, close, container }`; stub collaborators on `container`.
 */
export async function startServer(overrides = {}) {
  const container = createContainer(undefined, { orderNotifier: silentOrderNotifier(), ...overrides });
  const server = createApp(container).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (method, path, { body, headers = {}, raw } = {}) => {
    const init = { method, headers: { ...headers } };
    if (raw !== undefined) {
      init.body = raw;
    } else if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers["content-type"] = "application/json";
    }
    const response = await fetch(baseUrl + path, init);
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, json, text };
  };

  return {
    request,
    container,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * Starts a fresh server for the enclosing describe() (or file) and stops it
 * afterwards. Returns a handle whose `request`/`container` are ready inside tests.
 */
export function useTestServer(overrides) {
  const handle = {};
  before(async () => Object.assign(handle, await startServer(overrides)));
  after(() => handle.close());
  return handle;
}

/** Asserts a 400 response produced by the validate(Dto) middleware. */
export function expectValidationError(res) {
  assert.equal(res.status, 400);
  assert.equal(res.json.message, "validationErr");
}

export function makeUser(role = "User") {
  return {
    _id: new Types.ObjectId(),
    userName: "reader",
    email: "reader@example.com",
    role,
  };
}

/**
 * Returns an Authorization header for `user` and stubs the repository lookup
 * performed by the AuthGuard.
 */
export function authenticateAs(t, container, user) {
  t.mock.method(container.userRepository, "findAuthUserById", async () => user);
  const token = container.accessTokens.sign({ id: user._id.toString(), role: user.role });
  return { authorization: `${process.env.BEARER_KEY}${token}` };
}
