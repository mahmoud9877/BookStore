import joi from "joi";
import { CrudService } from "../../../core/crud-service.js";
import { ConflictError } from "../../../core/http-errors.js";
import { ResponseDto, crudDtos } from "../../../core/dto.js";
import { normalizeName } from "../../authors/models/author.model.js";

export class PublisherResponseDto extends ResponseDto {
  static fields = ["_id", "name", "website", "country", "createdAt"];
}

export const PublisherDtos = crudDtos({
  attributes: {
    name: joi.string().trim().max(200),
    website: joi.string().uri().allow(""),
    country: joi.string().trim().max(80).allow(""),
  },
  required: ["name"],
});

export class PublisherService extends CrudService {
  static entity = "Publisher";
  static searchFields = ["name"];
  static Dto = PublisherResponseDto;

  #books;

  constructor({ publisherRepository, bookRepository, auditService }) {
    super({ repository: publisherRepository, auditService });
    this.#books = bookRepository;
  }

  async beforeWrite(data) {
    if (data.name) data.normalizedName = normalizeName(data.name);
  }

  async beforeDelete(publisher) {
    if (await this.#books.countWhere({ publisher: publisher._id })) {
      throw new ConflictError("Books still list this publisher");
    }
  }
}
