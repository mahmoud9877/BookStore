import { publisherModel } from "./publisher.model.js";
import { BaseRepository } from "../../core/base-repository.js";

export class PublisherRepository extends BaseRepository {
  constructor(model = publisherModel) {
    super(model);
  }
}
