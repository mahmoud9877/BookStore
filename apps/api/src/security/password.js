import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export const hashPassword = ({ plaintext, saltRounds = env.saltRounds } = {}) => {
  return bcrypt.hashSync(plaintext, saltRounds);
};

export const comparePassword = ({ plaintext, hashValue } = {}) => {
  return bcrypt.compareSync(plaintext, hashValue);
};
