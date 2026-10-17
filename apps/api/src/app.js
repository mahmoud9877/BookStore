import cors from "cors";
import connectDB from "./infrastructure/database.js";
import bookPage from "./modules/books/book.routes.js";
import authPage from "./modules/auth/auth.routes.js";
import cartPage from "./modules/cart/cart.routes.js";
import orderPage from "./modules/orders/order.routes.js";
import { globalErrorHandling } from "./middleware/error-handler.js";
import categoryPage from "./modules/categories/category.routes.js";

const initApp = (app, express) => {
  connectDB();
  app.use(express.json({}));
  app.use(cors());
  app.get("/", (req, res, next) => {
    return res.status(200).send("Welcome in my bookStore project");
  });
  app.use("/cart", cartPage);
  app.use("/auth", authPage);
  app.use("/book", bookPage);
  app.use("/order", orderPage);
  app.use("/category", categoryPage);
  app.all("*", (req, res, next) => {
    res.send("In-valid Routing Plz check url or method");
  });
  app.use(globalErrorHandling);
};

export default initApp;
