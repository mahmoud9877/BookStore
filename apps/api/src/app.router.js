import cors from "cors";
import connectDB from "../DB/connection.js";
import bookPage from "../src/modules/Book/BookRouter.js";
import authPage from "../src/modules/auth/auth.router.js";
import cartPage from "../src/modules/cart/cart.router.js";
import orderPage from "../src/modules/order/order.router.js";
import { globalErrorHandling } from "./utils/errorHandling.js";
import categoryPage from "../src/modules/Category/category.router.js";

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
