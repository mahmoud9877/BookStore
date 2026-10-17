import { Types } from "mongoose";
import { createApp } from "../src/app.js";
import { generateToken } from "../src/security/token.js";
import userModel from "../src/modules/users/user.model.js";

/** Starts the app on an ephemeral port. Returns `{ request, close }`. */
export async function startServer() {
  const server = createApp().listen(0);
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

  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
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
 * Returns an Authorization header for `user` and stubs the user lookup
 * performed by the authenticate middleware.
 */
export function authenticateAs(t, user) {
  t.mock.method(userModel, "findById", () => ({ select: async () => user }));
  const token = generateToken({ payload: { id: user._id.toString(), role: user.role } });
  return { authorization: `${process.env.BEARER_KEY}${token}` };
}
