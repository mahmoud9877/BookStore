import mongoose from "mongoose";
import { env } from "../config/env.js";

// Keep the pre-Mongoose-7 behavior the queries in this codebase rely on.
mongoose.set("strictQuery", false);

export async function connectDatabase(uri = env.mongodbUri) {
  await mongoose.connect(uri);
  console.log("Database connected.");
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export function disconnectDatabase() {
  return mongoose.disconnect();
}
