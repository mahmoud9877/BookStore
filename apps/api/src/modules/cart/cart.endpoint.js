import { roles } from "../../middleware/authenticate.js";
const endpoint = {
  addToCart: [roles.User],
  deleteFromCart: [roles.User],
};
export default endpoint;
