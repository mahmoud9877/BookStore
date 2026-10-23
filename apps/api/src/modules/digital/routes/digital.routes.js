import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { asyncHandler } from "../../../middleware/error-handler.js";
import { UPLOAD_LIMITS, allowedMimeTypes, fileUpload } from "../../../middleware/upload.js";
import { PERMISSIONS } from "../../roles/constants/permissions.js";
import { CreatePublicationDto, ListPublicationsDto, PublicationIdDto, UpdatePublicationDto } from "../dtos/digital.dto.js";

const viewerOf = (req) => (req.user ? { user: req.user, access: req.access } : null);

export function createDigitalRouter({ digitalLibraryService: service, authGuard }) {
  const router = Router();
  const canManage = authGuard.requirePermission(PERMISSIONS.DigitalManage);
  const upload = fileUpload(allowedMimeTypes.publication, { maxBytes: UPLOAD_LIMITS.publication }).single("file");

  router.get("/", authGuard.optional(), validate(ListPublicationsDto), asyncHandler(async (req, res) => res.json(await service.list(req.dto, viewerOf(req)))));
  router.post("/", canManage, upload, validate(CreatePublicationDto), asyncHandler(async (req, res) => res.status(201).json({ data: await service.create(req.dto, req.file, req.access) })));
  router.patch("/:id", canManage, validate(UpdatePublicationDto), asyncHandler(async (req, res) => res.json({ data: await service.update(req.dto, req.access) })));
  router.delete("/:id", canManage, validate(PublicationIdDto), asyncHandler(async (req, res) => {
    await service.remove(req.dto.id, req.access);
    res.status(204).end();
  }));

  // Streams the file after checking access. Private: never cached by shared caches.
  router.get(
    "/:id/file",
    authGuard.optional(),
    validate(PublicationIdDto),
    asyncHandler(async (req, res) => {
      const { stream, size, mimeType, fileName, download } = await service.open(req.dto.id, viewerOf(req));
      res.set({
        "Content-Type": mimeType,
        "Content-Length": size,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      stream.pipe(res);
    })
  );
  return router;
}
