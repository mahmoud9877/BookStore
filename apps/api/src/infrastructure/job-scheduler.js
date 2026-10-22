import mongoose, { Schema, model } from "mongoose";

const jobLockSchema = new Schema({
  name: { type: String, required: true, unique: true },
  lockedUntil: { type: Date, default: null },
  lockedBy: String,
  lastRunAt: Date,
  lastResult: Schema.Types.Mixed,
  lastError: String,
});
const jobLockModel = mongoose.models.JobLock || model("JobLock", jobLockSchema);

/**
 * Runs named jobs every `everyMs`. A lease in the `joblocks` collection makes
 * sure only one worker runs a given job at a time, even with several workers;
 * a crashed worker's lease simply expires.
 */
export class JobScheduler {
  #jobs = [];
  #workerId;
  #log;
  #model;

  constructor({ workerId = `worker-${process.pid}`, log = console, model: lockModel = jobLockModel } = {}) {
    this.#workerId = workerId;
    this.#log = log;
    this.#model = lockModel;
  }

  /** `run()` resolves a small result (count) that is logged and stored. */
  add(name, everyMs, run) {
    this.#jobs.push({ name, everyMs, run });
    return this;
  }

  /** Runs every job that is due. Resolves `{ [name]: result | "skipped" | "error" }`. */
  async tick(now = new Date()) {
    const results = {};
    for (const job of this.#jobs) {
      results[job.name] = await this.#runIfDue(job, now);
    }
    return results;
  }

  async #runIfDue({ name, everyMs, run }, now) {
    const lease = await this.#acquire(name, everyMs, now);
    if (!lease) return "skipped";
    try {
      const result = await run();
      await this.#model.updateOne({ name }, { $set: { lockedUntil: null, lastRunAt: now, lastResult: result, lastError: null } });
      // Log only runs that did something, so an idle worker stays quiet.
      if (result && Object.values(result).some((value) => (Array.isArray(value) ? value.length : value))) {
        this.#log.log(`[worker] ${name}: ${JSON.stringify(result)}`);
      }
      return result;
    } catch (error) {
      await this.#model.updateOne({ name }, { $set: { lockedUntil: null, lastRunAt: now, lastError: error.message } });
      this.#log.error(`[worker] ${name} failed: ${error.message}`);
      return "error";
    }
  }

  /** Takes the lease when the job is due and nobody holds it. */
  async #acquire(name, everyMs, now) {
    const leaseMs = Math.max(everyMs, 5 * 60_000);
    try {
      const lock = await this.#model.findOneAndUpdate(
        {
          name,
          $and: [
            { $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
            { $or: [{ lastRunAt: null }, { lastRunAt: { $lte: new Date(now.getTime() - everyMs + 1000) } }] },
          ],
        },
        { $set: { lockedUntil: new Date(now.getTime() + leaseMs), lockedBy: this.#workerId } },
        { new: true, upsert: true }
      );
      return Boolean(lock);
    } catch (error) {
      if (error.code === 11000) return false; // another worker created/holds it
      throw error;
    }
  }
}
