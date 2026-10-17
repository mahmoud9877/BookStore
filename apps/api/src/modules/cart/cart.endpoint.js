import { roles } from "../../middleware/auth.js";
const endpoint = {
  addToCart: [roles.User],
  deleteFromCart: [roles.User],
};
export default endpoint;
