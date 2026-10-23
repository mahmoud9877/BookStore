import { AuditLogResponseDto } from "../dtos/audit.dto.js";
import { pageOf, toSort } from "../../../core/pagination.js";

// Keys whose values must never reach the audit log, at any depth.
const SECRET_KEYS = /pass(word)?|token|secret|code|signature|card|cvc|iban/i;

/** Copies `value` without secrets, Mongoose internals or deep nesting. */
export function sanitize(value, depth = 0) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (value._bsontype === "ObjectID" || value._bsontype === "ObjectId") return String(value);
  if (depth > 4) return "[…]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "__v" && !SECRET_KEYS.test(key))
      .map(([key, item]) => [key, sanitize(item, depth + 1)])
  );
}

/** Records and lists sensitive actions. Recording joins the caller's transaction. */
export class AuditService {
  #logs;

  constructor({ auditLogRepository }) {
    this.#logs = auditLogRepository;
  }

  /**
   * @param {{ userId?: unknown, userName?: string } | null} actor null for the system
   * @param {{ action: string, entity: string, entityId?: unknown, branch?: unknown,
   *           before?: object, after?: object, reason?: string }} event
   */
  record(actor, { action, entity, entityId = null, branch = null, before, after, reason }) {
    return this.#logs.create({
      actor: actor?.userId ?? null,
      actorName: actor?.userName ?? "system",
      action,
      entity,
      entityId: entityId == null ? null : String(entityId),
      branch,
      before: sanitize(before),
      after: sanitize(after),
      reason,
    });
  }

  /** @param {import("../dtos/audit.dto.js").ListAuditLogsDto} query */
  /** Staff limited to assigned branches see only those branches' entries. */
  async list({ page, limit, sort, action, entity, entityId, actor, from, to }, viewer) {
    const filter = viewer ? { ...viewer.branchFilter("branch") } : {};
    if (action) filter.action = action;
    if (entity) filter.entity = entity;
    if (entityId) filter.entityId = entityId;
    if (actor) filter.actor = actor;
    if (from || to) filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    const result = await this.#logs.paginate(filter, { page, limit, sort: toSort(sort) });
    return pageOf({ ...result, items: AuditLogResponseDto.fromList(result.items) }, { page, limit });
  }
}
