import joi from "joi";
import { BaseRepository } from "../../core/base-repository.js";
import { RequestDto, ResponseDto, fields } from "../../core/dto.js";
import { escapeRegExp, pageOf, paginationKeys, toSort } from "../../core/pagination.js";
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError, ensureFound } from "../../core/http-errors.js";
import { MemberPolicy } from "../members/member-policy.js";
import { PERMISSIONS } from "../roles/permissions.js";
import { DIGITAL_ACCESS, LICENSE_TYPES, digitalAccessLogModel, digitalPublicationModel } from "./digital.model.js";

export class DigitalPublicationRepository extends BaseRepository { constructor(model = digitalPublicationModel) { super(model); } }
export class DigitalAccessLogRepository extends BaseRepository { constructor(model = digitalAccessLogModel) { super(model); } }

const FORMAT_BY_MIME = { "application/pdf": "pdf", "application/epub+zip": "epub", "audio/mpeg": "audio", "video/mp4": "video" };

const attributes = {
  title: joi.string().trim().max(300),
  book: fields.ref().allow(null, ""),
  description: joi.string().trim().max(5000).allow(""),
  authors: joi.string().trim().max(300).allow(""),
  access: joi.string().valid(...Object.values(DIGITAL_ACCESS)),
  membershipTypes: joi.alternatives().try(joi.array().items(fields.ref()), joi.string().allow("")).custom((value) => (Array.isArray(value) ? value : value.split(",").filter(Boolean))),
  allowDownload: joi.boolean(),
  licenseType: joi.string().valid(...LICENSE_TYPES),
  licenseHolder: joi.string().trim().max(200).allow(""),
  licenseExpiresAt: joi.date().allow(null, ""),
  licenseTerms: joi.string().trim().max(2000).allow(""),
  isPublished: joi.boolean(),
};

export class ListPublicationsDto extends RequestDto {
  static schema = joi.object({ ...paginationKeys(["title", "createdAt"], "title"), search: joi.string().trim().max(100).allow(""), format: joi.string(), includeUnpublished: joi.boolean().default(false) });
}
export class CreatePublicationDto extends RequestDto {
  static schema = joi.object({ ...attributes, title: attributes.title.required(), licenseType: attributes.licenseType.required() });
}
export class UpdatePublicationDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId(), ...attributes }).min(2);
}
export class PublicationIdDto extends RequestDto {
  static schema = joi.object({ id: fields.objectId() });
}
export class PublicationResponseDto extends ResponseDto {
  static fields = ["_id", "title", "book", "description", "authors", "format", "fileSize", "access", "membershipTypes", "allowDownload", "license", "isPublished", "canOpen", "createdAt"];

  constructor(source) {
    // The storage key never leaves the API.
    super({ ...source, fileSize: source.file?.size });
  }
}

const licenseFrom = (dto, current = {}) => ({
  type: dto.licenseType ?? current.type,
  holder: dto.licenseHolder ?? current.holder,
  expiresAt: dto.licenseExpiresAt === "" ? null : dto.licenseExpiresAt ?? current.expiresAt,
  terms: dto.licenseTerms ?? current.terms,
});

/** Digital publications: upload, catalogue, and serve them only to those entitled. */
export class DigitalLibraryService {
  #publications;
  #accessLog;
  #members;
  #files;
  #audit;

  constructor({ digitalPublicationRepository, digitalAccessLogRepository, memberRepository, privateFileStorage, auditService }) {
    this.#publications = digitalPublicationRepository;
    this.#accessLog = digitalAccessLogRepository;
    this.#members = memberRepository;
    this.#files = privateFileStorage;
    this.#audit = auditService;
  }

  /** Published titles (staff may include unpublished), each flagged with whether the viewer can open it. */
  async list({ page, limit, sort, search, format, includeUnpublished }, viewer) {
    const isStaff = viewer?.access?.can(PERMISSIONS.DigitalManage);
    const filter = includeUnpublished && isStaff ? {} : { isPublished: true };
    if (!isStaff) filter.access = { $ne: DIGITAL_ACCESS.staff };
    if (format) filter.format = format;
    if (search) {
      const pattern = new RegExp(escapeRegExp(search), "i");
      filter.$or = [{ title: pattern }, { authors: pattern }];
    }
    const result = await this.#publications.paginate(filter, { page, limit, sort: toSort(sort) });
    const member = viewer?.user ? await this.#members.findByUser(viewer.user._id) : null;
    const items = result.items.map((publication) => PublicationResponseDto.from({ ...publication, canOpen: !this.#denial(publication, viewer, member) }));
    return pageOf({ ...result, items }, { page, limit });
  }

  async create(dto, file, actor) {
    if (!file) throw new BadRequestError("Attach the publication file");
    const format = FORMAT_BY_MIME[file.mimetype];
    if (!format) throw new BadRequestError("Unsupported file type");
    const key = await this.#files.save(file.path, { folder: "digital", originalName: file.originalname });
    const publication = await this.#publications.create({
      title: dto.title, book: dto.book || null, description: dto.description, authors: dto.authors,
      access: dto.access, membershipTypes: dto.membershipTypes ?? [], allowDownload: dto.allowDownload ?? false,
      isPublished: dto.isPublished ?? false, format, license: licenseFrom(dto),
      file: { key, mimeType: file.mimetype, size: file.size, originalName: file.originalname }, uploadedBy: actor.userId,
    });
    await this.#audit.record(actor, { action: "digital.create", entity: "DigitalPublication", entityId: publication._id, after: { title: dto.title, access: dto.access, license: publication.license } });
    return PublicationResponseDto.from(publication);
  }

  async update({ id, ...dto }, actor) {
    const current = ensureFound(await this.#publications.findById(id), "Publication not found");
    const update = {};
    for (const key of ["title", "description", "authors", "access", "membershipTypes", "allowDownload", "isPublished"]) {
      if (dto[key] !== undefined) update[key] = dto[key];
    }
    if (dto.book !== undefined) update.book = dto.book || null;
    if (["licenseType", "licenseHolder", "licenseExpiresAt", "licenseTerms"].some((key) => dto[key] !== undefined)) {
      update.license = licenseFrom(dto, current.license);
    }
    const updated = await this.#publications.updateById(id, update);
    await this.#audit.record(actor, { action: "digital.update", entity: "DigitalPublication", entityId: id, before: { access: current.access, license: current.license, isPublished: current.isPublished }, after: update });
    return PublicationResponseDto.from(updated);
  }

  async remove(id, actor) {
    const publication = ensureFound(await this.#publications.deleteById(id), "Publication not found");
    await this.#files.remove(publication.file.key);
    await this.#audit.record(actor, { action: "digital.delete", entity: "DigitalPublication", entityId: id, before: { title: publication.title } });
  }

  /**
   * Resolves `{ stream, size, mimeType, fileName, download }` when the viewer
   * may open the publication; otherwise throws 401/403/404.
   * @param {{ user?, access? } | null} viewer null for anonymous requests
   */
  async open(id, viewer) {
    const publication = ensureFound(await this.#publications.findById(id), "Publication not found");
    const member = viewer?.user ? await this.#members.findByUser(viewer.user._id) : null;
    const denial = this.#denial(publication, viewer, member);
    if (denial) throw denial;
    const file = await this.#files.open(publication.file.key);
    await this.#accessLog.create({ publication: publication._id, user: viewer?.user?._id ?? null, member: member?._id ?? null });
    return { ...file, mimeType: publication.file.mimeType, fileName: publication.file.originalName ?? `${publication.title}.${publication.format}`, download: publication.allowDownload };
  }

  /** Why the viewer cannot open the publication (an HttpError), or null. */
  #denial(publication, viewer, member) {
    const isStaff = viewer?.access?.can(PERMISSIONS.DigitalManage);
    if (isStaff) return null;
    if (!publication.isPublished) return new NotFoundError("Publication not found");
    if (publication.license?.expiresAt && new Date(publication.license.expiresAt) <= new Date()) {
      return new ForbiddenError("The licence for this publication has expired");
    }
    if (publication.access === DIGITAL_ACCESS.public) return null;
    if (publication.access === DIGITAL_ACCESS.staff) return new NotFoundError("Publication not found");
    if (!viewer?.user) return new UnauthorizedError("Sign in with a library membership to open this publication");
    if (!member) return new ForbiddenError("A library membership is required");
    if (MemberPolicy.blockReason(member)) return new ForbiddenError(MemberPolicy.blockReason(member));
    const typeId = String(member.membershipType?._id ?? member.membershipType);
    if (member.membershipType?.canAccessDigital === false) return new ForbiddenError("Your membership type does not include the digital library");
    if (publication.access === DIGITAL_ACCESS.membershipTypes && !publication.membershipTypes.map(String).includes(typeId)) {
      return new ForbiddenError("Your membership type does not include this publication");
    }
    return null;
  }
}
