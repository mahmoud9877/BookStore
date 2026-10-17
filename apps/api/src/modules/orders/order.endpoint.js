import { roles } from "../../middleware/authenticate.js";

export const endpoint = {
  create: [roles.Admin],
  cancel: [roles.Admin],
  delivered: [roles.Admin],
};
