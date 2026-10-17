import cors from "cors";
import morgan from "morgan";
import express from "express";
import { createContainer } from "./container.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import { createBookRouter } from "./modules/books/book.routes.js";
import { createCartRouter } from "./modules/cart/cart.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { createCategoryRouter } from "./modules/categories/category.routes.js";
import { createErrorHandler, notFoundHandler } from "./middleware/error-handler.js";

/**
 * Builds the Express application from a container of collaborators.
 * Does not connect to the database or listen.
 */
export function createApp(container = createContainer()) {
  const { config } = container;
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors());
  if (config.nodeEnv === "development") {
    app.use(morgan("dev", { skip: (req) => req.path === "/health" }));
  }

  // Payment providers sign the raw payload, so this route must see the body before express.json().
  app.post(
    "/order/webhook",
    express.raw({ type: "application/json" }),
    container.orderController.paymentWebhook
  );

  app.use(express.json());

  app.get("/", (req, res) => {
    return res.status(200).send("Welcome in my bookStore project");
  });
  app.get("/health", (req, res) => {
    const database = container.database.isConnected ? "up" : "down";
    return res
      .status(database === "up" ? 200 : 503)
      .json({ status: database === "up" ? "ok" : "degraded", database });
  });

  app.use("/auth", createAuthRouter(container));
  app.use("/auth", createUserRouter(container));
  app.use("/book", createBookRouter(container));
  app.use("/cart", createCartRouter(container));
  app.use("/order", createOrderRouter(container));
  app.use("/category", createCategoryRouter(container));

  app.use(notFoundHandler);
  app.use(createErrorHandler({ isProduction: config.isProduction }));

  return app;
}
