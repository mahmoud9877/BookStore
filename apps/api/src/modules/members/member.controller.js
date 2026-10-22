import { asyncHandler } from "../../middleware/error-handler.js";

export class MemberController {
  #memberService;

  constructor(memberService) {
    this.#memberService = memberService;
  }

  list = asyncHandler(async (req, res) => res.json(await this.#memberService.list(req.dto, req.access)));

  get = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.get(req.dto.id, req.access) }));

  getByNumber = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.getByNumber(req.params.memberNumber) }));

  getOwn = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.getOwn(req.user._id) }));

  history = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.history(req.dto.id, req.access) }));

  register = asyncHandler(async (req, res) => res.status(201).json({ data: await this.#memberService.register(req.dto, req.access) }));

  update = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.update(req.dto, req.access) }));

  renew = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.renew(req.dto, req.access) }));

  suspend = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.suspend(req.dto, req.access) }));

  reactivate = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.reactivate(req.dto, req.access) }));

  cancel = asyncHandler(async (req, res) => res.json({ data: await this.#memberService.cancel(req.dto, req.access) }));
}
