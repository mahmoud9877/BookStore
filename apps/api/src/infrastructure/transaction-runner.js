import mongoose from "mongoose";
import { currentSession, runWithSession } from "../core/transaction-context.js";

/**
 * Runs a unit of work in a MongoDB transaction (retried on transient errors by
 * the driver). Repositories used inside `fn` join it automatically. Nested
 * calls reuse the outer transaction.
 *
 * Transactions need a replica set: the development compose file runs MongoDB as
 * a single-node replica set, and MongoDB Atlas always is one.
 */
export class TransactionRunner {
  async run(fn) {
    if (currentSession()) return fn();
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await runWithSession(session, fn);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
}

/** For unit tests: runs the work directly, without a database. */
export class InlineTransactionRunner {
  run(fn) {
    return fn();
  }
}
