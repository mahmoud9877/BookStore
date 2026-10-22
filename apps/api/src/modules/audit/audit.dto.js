import joi from "joi";
import { RequestDto, ResponseDto } from "../../core/dto.js";
import { paginationKeys } from "../../core/pagination.js";

export class ListAuditLogsDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt"]),
    action: joi.string().trim(),
    entity: joi.string().trim(),
    entityId: joi.string().trim(),
    actor: joi.string().hex().length(24),
    from: joi.date(),
    to: joi.date(),
  });
}

export class AuditLogResponseDto extends ResponseDto {
  static fields = ["_id", "actor", "actorName", "action", "entity", "entityId", "branch", "before", "after", "reason", "createdAt"];
}
