import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const generateToken = ({
  payload = {},
  signature = env.tokenSignature,
  expiresIn = 60 * 60,
} = {}) => {
  return jwt.sign(payload, signature, { expiresIn: parseInt(expiresIn) });
};

export const verifyToken = ({ token, signature = env.tokenSignature } = {}) => {
  return jwt.verify(token, signature);
};
