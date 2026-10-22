import cors from "cors";
import morgan from "morgan";
import express from "express";
import { createContainer } from "./container.js";
import { asyncHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import { createBookRouter } from "./modules/books/book.routes.js";
import { createCartRouter } from "./modules/cart/cart.routes.js";
import { createOrderRouter } from "./modules/orders/order.routes.js";
import { createCategoryRouter } from "./modules/categories/category.routes.js";
import { createRoleRouter } from "./modules/roles/role.routes.js";
import { createAuditRouter } from "./modules/audit/audit.routes.js";
import { createSettingsRouter } from "./modules/settings/settings.routes.js";
import { createBranchRouter, createLocationRouter } from "./modules/branches/branch.routes.js";
import { createAuthorRouter, createPublisherRouter } from "./modules/authors/author.routes.js";
import { createCopyRouter } from "./modules/copies/copy.routes.js";
import { createMemberRouter, createMembershipTypeRouter } from "./modules/members/member.routes.js";
import { createLoanRouter, createReservationRouter } from "./modules/circulation/circulation.routes.js";
import { createFineRouter, createPaymentRouter } from "./modules/finance/finance.routes.js";
import { createTransferRouter } from "./modules/transfers/transfer.routes.js";
import { createNotificationRouter } from "./modules/notifications/notification.routes.js";
import { createPurchaseOrderRouter, createSupplierRouter } from "./modules/acquisitions/acquisition.routes.js";
import { createStocktakeRouter } from "./modules/inventory/inventory.routes.js";
import { createReportRouter } from "./modules/reports/report.routes.js";
import { createEventRouter, createRoomRouter } from "./modules/facilities/facility.routes.js";
import { createDigitalRouter } from "./modules/digital/digital.routes.js";
import { createCatalogRouter } from "./modules/discovery/catalog.routes.js";
import { createAssistantRouter } from "./modules/assistant/assistant.routes.js";
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
  app.use(cors(config.corsOrigins ? { origin: config.corsOrigins } : undefined));
  app.use((req, res, next) => {
    res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    next();
  });
  if (config.nodeEnv === "development") {
    app.use(morgan("dev", { skip: (req) => req.path === "/health" }));
  }

  // Payment providers sign the raw payload, so this route must see the body
  // before express.json(). One endpoint serves shop orders and library fines.
  const paymentWebhook = asyncHandler(async (req, res) => {
    const message = await container.paymentWebhookService.handle(req.body, req.headers["stripe-signature"]);
    return res.json({ message });
  });
  app.post("/order/webhook", express.raw({ type: "application/json" }), paymentWebhook);
  app.post("/payments/webhook", express.raw({ type: "application/json" }), paymentWebhook);

  app.use(express.json({ limit: "1mb" }));

  app.get("/", (req, res) => {
    return res.status(200).send("Welcome in my bookStore project");
  });
  app.get("/health", (req, res) => {
    const database = container.database.isConnected ? "up" : "down";
    return res
      .status(database === "up" ? 200 : 503)
      .json({ status: database === "up" ? "ok" : "degraded", database });
  });

  // Public files only (book covers stored locally). Private documents are never served statically.
  app.use(
    "/uploads",
    express.static(container.publicFileStorage.root, { index: false, dotfiles: "deny", maxAge: "7d", fallthrough: true })
  );

  app.use("/auth/login", container.authRateLimiter);
  app.use("/auth/signup", container.authRateLimiter);
  app.use("/auth", createAuthRouter(container));
  app.use("/auth", createUserRouter(container));
  app.use("/book", createBookRouter(container));
  app.use("/cart", createCartRouter(container));
  app.use("/order", createOrderRouter(container));
  app.use("/category", createCategoryRouter(container));
  app.use("/role", createRoleRouter(container));

  // Library modules (plural resource names; `{ data }` / `{ data, meta }` responses).
  app.use("/catalog", createCatalogRouter(container));
  app.use("/assistant", createAssistantRouter({ ...container, rateLimiter: container.assistantRateLimiter }));
  app.use("/authors", createAuthorRouter(container));
  app.use("/publishers", createPublisherRouter(container));
  app.use("/branches", createBranchRouter(container));
  app.use("/locations", createLocationRouter(container));
  app.use("/copies", createCopyRouter(container));
  app.use("/members", createMemberRouter(container));
  app.use("/membership-types", createMembershipTypeRouter(container));
  app.use("/loans", createLoanRouter(container));
  app.use("/reservations", createReservationRouter(container));
  app.use("/fines", createFineRouter(container));
  app.use("/payments", createPaymentRouter(container));
  app.use("/transfers", createTransferRouter(container));
  app.use("/suppliers", createSupplierRouter(container));
  app.use("/purchase-orders", createPurchaseOrderRouter(container));
  app.use("/stocktakes", createStocktakeRouter(container));
  app.use("/rooms", createRoomRouter(container));
  app.use("/events", createEventRouter(container));
  app.use("/digital", createDigitalRouter(container));
  app.use("/notifications", createNotificationRouter(container));
  app.use("/reports", createReportRouter(container));
  app.use("/audit-logs", createAuditRouter(container));
  app.use("/settings", createSettingsRouter(container));

  app.use(notFoundHandler);
  app.use(createErrorHandler({ isProduction: config.isProduction }));

  return app;
}
