import { BaseRepository } from "../../../core/base-repository.js";
import { digitalAccessLogModel, digitalPublicationModel } from "../models/digital.model.js";

export class DigitalPublicationRepository extends BaseRepository {
  constructor(model = digitalPublicationModel) {
    super(model);
  }
}

export class DigitalAccessLogRepository extends BaseRepository {
  constructor(model = digitalAccessLogModel) {
    super(model);
  }
}
