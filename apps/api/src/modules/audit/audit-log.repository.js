import { auditLogModel } from "./audit-log.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class AuditLogRepository extends BaseRepository {
  constructor(model = auditLogModel) {
    super(model);
  }

  /** Actions per actor in a period: `[{ actor, actorName, actions, lastAt }]`. */
  activityByActor(filter) {
    return this.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$actor",
          actorName: { $last: "$actorName" },
          actions: { $sum: 1 },
          lastAt: { $max: "$createdAt" },
        },
      },
      { $sort: { actions: -1 } },
      { $project: { _id: 0, actor: "$_id", actorName: 1, actions: 1, lastAt: 1 } },
    ]);
  }
}
