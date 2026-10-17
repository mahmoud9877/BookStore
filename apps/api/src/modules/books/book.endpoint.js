import { roles } from "../../middleware/authenticate.js";
export const endpoint = {
  addBook: [roles.User],
  deleteBook: [roles.Admin],
  updateBook: [roles.Admin],
  getBook: [roles.User],
};
