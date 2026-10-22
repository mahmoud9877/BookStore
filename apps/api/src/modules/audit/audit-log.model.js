import mongoose, { Schema, Types, model } from "mongoose";

// Append-only record of sensitive actions. Never updated or deleted by the API.
const auditLogSchema = new Schema(
  {
    actor: { type: Types.ObjectId, ref: "User", default: null }, // null: the system (jobs, migrations)
    actorName: String,
    action: { type: String, required: true }, // e.g. "loan.checkout", "role.update"
    entity: { type: String, required: true }, // e.g. "Loan", "Role"
    entityId: { type: String, default: null },
    branch: { type: Types.ObjectId, ref: "Branch", default: null },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    reason: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const auditLogModel = mongoose.models.AuditLog || model("AuditLog", auditLogSchema);
