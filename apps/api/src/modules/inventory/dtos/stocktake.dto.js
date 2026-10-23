import joi from "joi";
import { RequestDto, ResponseDto, fields } from "../../../core/dto.js";
import { paginationKeys } from "../../../core/pagination.js";
import { STOCKTAKE_STATUSES } from "../models/stocktake.model.js";

export class ListStocktakesDto extends RequestDto {
  static schema = joi.object({
    ...paginationKeys(["createdAt"]),
    branch: fields.ref(),
    status: joi.string().valid(...Object.values(STOCKTAKE_STATUSES)),
  });
}

export class StartStocktakeDto extends RequestDto {
  static schema = joi.object({
    branch: fields.objectId(),
    location: fields.ref(),
    notes: joi.string().trim().max(500).allow(""),
  });
}

export class ScanDto extends RequestDto {
  static schema = joi.object({
    id: fields.objectId(),
    barcodes: joi.array().items(joi.string().trim().uppercase().max(40)).min(1).max(500).required(),
  });
}

export class CloseStocktakeDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), apply: joi.boolean().default(true) });
}

export class StocktakeIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}

export class StocktakeResponseDto extends ResponseDto {
  static fields = ["_id", "branch", "location", "status", "startedBy", "closedAt", "notes", "result", "progress", "createdAt"];
}
