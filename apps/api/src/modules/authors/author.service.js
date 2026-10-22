import joi from "joi";
import { CrudService } from "../../core/crud-service.js";
import { ConflictError } from "../../core/http-errors.js";
import { ResponseDto, crudDtos } from "../../core/dto.js";
import { normalizeName } from "./author.model.js";

export class AuthorResponseDto extends ResponseDto {
  static fields = ["_id", "name", "bio", "createdAt"];
}

export const AuthorDtos = crudDtos({
  attributes: { name: joi.string().trim().max(200), bio: joi.string().trim().max(5000).allow("") },
  required: ["name"],
});

export class AuthorService extends CrudService {
  static entity = "Author";
  static searchFields = ["name"];
  static Dto = AuthorResponseDto;

  #books;

  constructor({ authorRepository, bookRepository, auditService }) {
    super({ repository: authorRepository, auditService });
    this.#books = bookRepository;
  }

  async beforeWrite(data) {
    if (data.name) data.normalizedName = normalizeName(data.name);
  }

  async beforeDelete(author) {
    if (await this.#books.countWhere({ authors: author._id })) {
      throw new ConflictError("Books still list this author");
    }
  }
}
