import cors from "cors";
import morgan from "morgan";
import express from "express";
import { env } from "./config/env.js";
import authRouter from "./modules/auth/auth.routes.js";
import bookRouter from "./modules/books/book.routes.js";
import cartRouter from "./modules/cart/cart.routes.js";
import orderRouter from "./modules/orders/order.routes.js";
import { isDatabaseConnected } from "./infrastructure/database.js";
import categoryRouter from "./modules/categories/category.routes.js";
import { stripeWebhook } from "./modules/orders/order.controller.js";
import { globalErrorHandler, notFoundHandler } from "./middleware/error-handler.js";

/** Builds the Express application. Does not connect to the database or listen. */
export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors());
  if (env.nodeEnv === "development") {
    app.use(morgan("dev", { skip: (req) => req.path === "/health" }));
  }

  // Stripe signs the raw payload, so this route must see the body before express.json().
  app.post("/order/webhook", express.raw({ type: "application/json" }), stripeWebhook);

  app.use(express.json());

  app.get("/", (req, res) => {
    return res.status(200).send("Welcome in my bookStore project");
  });
  app.get("/health", (req, res) => {
    const database = isDatabaseConnected() ? "up" : "down";
    return res
      .status(database === "up" ? 200 : 503)
      .json({ status: database === "up" ? "ok" : "degraded", database });
  });

  app.use("/auth", authRouter);
  app.use("/book", bookRouter);
  app.use("/cart", cartRouter);
  app.use("/order", orderRouter);
  app.use("/category", categoryRouter);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
