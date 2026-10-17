// Builds an unsigned JWT-shaped string; the client only decodes tokens, it never verifies them.
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function makeToken(claims = {}) {
  const payload = { id: "user-1", userName: "reader", role: "User", exp: Date.now() / 1000 + 3600, ...claims };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
}
