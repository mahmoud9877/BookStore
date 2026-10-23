import { BaseRepository } from "../../../core/base-repository.js";
import { stocktakeModel, stocktakeScanModel } from "../models/stocktake.model.js";

export class StocktakeRepository extends BaseRepository {
  constructor(model = stocktakeModel) {
    super(model);
  }
}

export class StocktakeScanRepository extends BaseRepository {
  constructor(model = stocktakeScanModel) {
    super(model);
  }
}
