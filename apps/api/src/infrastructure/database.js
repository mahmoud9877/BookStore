import mongoose from "mongoose";

// Keep the pre-Mongoose-7 behavior the queries in this codebase rely on.
mongoose.set("strictQuery", false);

export class Database {
  #uri;
  #autoIndex;

  /**
   * `autoIndex`: let Mongoose build indexes at start-up (development). In
   * production indexes are created by the migrations (`npm run migrate`).
   */
  constructor(uri, { autoIndex = true } = {}) {
    this.#uri = uri;
    this.#autoIndex = autoIndex;
  }

  async connect() {
    await mongoose.connect(this.#uri, { autoIndex: this.#autoIndex, serverSelectionTimeoutMS: 15_000 });
    console.log("Database connected.");
  }

  disconnect() {
    return mongoose.disconnect();
  }

  get isConnected() {
    return mongoose.connection.readyState === 1;
  }
}
