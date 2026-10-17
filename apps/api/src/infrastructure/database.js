import mongoose from "mongoose";

// Keep the pre-Mongoose-7 behavior the queries in this codebase rely on.
mongoose.set("strictQuery", false);

export class Database {
  #uri;

  constructor(uri) {
    this.#uri = uri;
  }

  async connect() {
    await mongoose.connect(this.#uri);
    console.log("Database connected.");
  }

  disconnect() {
    return mongoose.disconnect();
  }

  get isConnected() {
    return mongoose.connection.readyState === 1;
  }
}
