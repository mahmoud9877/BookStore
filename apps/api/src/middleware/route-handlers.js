import { asyncHandler } from "./error-handler.js";

export const sendData = (status, resolve) =>
  asyncHandler(async (req, res) => res.status(status).json({ data: await resolve(req) }));

export const sendResult = (resolve) =>
  asyncHandler(async (req, res) => res.json(await resolve(req)));
