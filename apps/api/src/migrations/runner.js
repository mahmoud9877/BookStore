import mongoose, { Schema, model } from "mongoose";

const migrationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  appliedAt: { type: Date, required: true },
  durationMs: Number,
  result: Schema.Types.Mixed,
});
const migrationModel = mongoose.models.Migration || model("Migration", migrationSchema);

const lockSchema = new Schema({ _id: String, lockedUntil: Date, lockedBy: String });
const migrationLockModel = mongoose.models.MigrationLock || model("MigrationLock", lockSchema, "migrationlocks");

/**
 * Applies data/schema migrations in order, once each, recording them in the
 * `migrations` collection. Only one runner works at a time (a lease lock), and
 * migrations must be idempotent: a failure leaves the rest pending, and the
 * failed one is retried on the next run.
 */
export class MigrationRunner {
  #migrations;
  #context;
  #log;

  constructor(migrations, context, { log = console } = {}) {
    this.#migrations = migrations;
    this.#context = context;
    this.#log = log;
  }

  async status() {
    const applied = new Map((await migrationModel.find().lean()).map((row) => [row.id, row]));
    return this.#migrations.map(({ id, description }) => ({ id, description, appliedAt: applied.get(id)?.appliedAt ?? null }));
  }

  async pending() {
    return (await this.status()).filter((migration) => !migration.appliedAt);
  }

  async up() {
    if (!(await this.#lock())) throw new Error("Another migration run is in progress");
    try {
      const applied = [];
      for (const { id } of await this.pending()) {
        const migration = this.#migrations.find((item) => item.id === id);
        const started = Date.now();
        this.#log.log(`→ ${id}: ${migration.description}`);
        const result = await migration.up(this.#context);
        await migrationModel.create({ id, appliedAt: new Date(), durationMs: Date.now() - started, result });
        this.#log.log(`  done${result ? ` (${JSON.stringify(result)})` : ""}`);
        applied.push(id);
      }
      return applied;
    } finally {
      await migrationLockModel.deleteOne({ _id: "lock" });
    }
  }

  async #lock() {
    try {
      await migrationLockModel.findOneAndUpdate(
        { _id: "lock", $or: [{ lockedUntil: { $lt: new Date() } }, { lockedUntil: null }] },
        { $set: { lockedUntil: new Date(Date.now() + 30 * 60_000), lockedBy: `pid-${process.pid}` } },
        { upsert: true }
      );
      return true;
    } catch (error) {
      if (error.code === 11000) return false;
      throw error;
    }
  }
}
