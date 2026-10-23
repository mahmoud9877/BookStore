import path from "node:path";
import { createHmac } from "node:crypto";
import { env } from "./config/env.js";
import { Database } from "./infrastructure/database.js";
import { AuthGuard } from "./middleware/auth-guard.js";
import { rateLimit } from "./middleware/rate-limit.js";
import { LogMailer } from "./infrastructure/log-mailer.js";
import { GmailMailer } from "./infrastructure/gmail-mailer.js";
import { SequenceGenerator } from "./infrastructure/counter.js";
import { TransactionRunner } from "./infrastructure/transaction-runner.js";
import { PasswordHasher } from "./security/password-hasher.js";
import { JwtTokenService } from "./security/jwt-token-service.js";
import { StripePaymentGateway } from "./infrastructure/stripe-payment-gateway.js";
import { CloudinaryImageStorage } from "./infrastructure/cloudinary-image-storage.js";
import { LocalFileStorage, LocalImageStorage } from "./infrastructure/local-file-storage.js";
import { AuthService } from "./modules/auth/services/auth.service.js";
import { AuthController } from "./modules/auth/controllers/auth.controller.js";
import { EmailConfirmationService } from "./modules/auth/services/email-confirmation.service.js";
import { AuthSessionRepository } from "./modules/auth/repositories/auth-session.repository.js";
import { UserService } from "./modules/users/services/user.service.js";
import { UserController } from "./modules/users/controllers/user.controller.js";
import { UserRepository } from "./modules/users/repositories/user.repository.js";
import { BookService } from "./modules/books/services/book.service.js";
import { BookController } from "./modules/books/controllers/book.controller.js";
import { BookRepository } from "./modules/books/repositories/book.repository.js";
import { CategoryService } from "./modules/categories/services/category.service.js";
import { CategoryController } from "./modules/categories/controllers/category.controller.js";
import { CategoryRepository } from "./modules/categories/repositories/category.repository.js";
import { CartService } from "./modules/cart/services/cart.service.js";
import { CartController } from "./modules/cart/controllers/cart.controller.js";
import { CartRepository } from "./modules/cart/repositories/cart.repository.js";
import { OrderService } from "./modules/orders/services/order.service.js";
import { OrderController } from "./modules/orders/controllers/order.controller.js";
import { OrderRepository } from "./modules/orders/repositories/order.repository.js";
import { CouponService } from "./modules/coupons/services/coupon.service.js";
import { CouponRepository } from "./modules/coupons/repositories/coupon.repository.js";
import { RoleService } from "./modules/roles/services/role.service.js";
import { RoleController } from "./modules/roles/controllers/role.controller.js";
import { RoleRepository } from "./modules/roles/repositories/role.repository.js";
import { AuditService } from "./modules/audit/services/audit.service.js";
import { AuditController } from "./modules/audit/controllers/audit.controller.js";
import { AuditLogRepository } from "./modules/audit/repositories/audit-log.repository.js";
import { SettingsService } from "./modules/settings/services/settings.service.js";
import { SettingsController } from "./modules/settings/controllers/settings.controller.js";
import { SettingRepository } from "./modules/settings/repositories/setting.repository.js";
import { BranchService, LocationService } from "./modules/branches/services/branch.service.js";
import { BranchRepository, LocationRepository } from "./modules/branches/repositories/branch.repository.js";
import { AuthorService } from "./modules/authors/services/author.service.js";
import { AuthorRepository } from "./modules/authors/repositories/author.repository.js";
import { PublisherService } from "./modules/publishers/services/publisher.service.js";
import { PublisherRepository } from "./modules/publishers/repositories/publisher.repository.js";
import { CopyService } from "./modules/copies/services/copy.service.js";
import { CopyController } from "./modules/copies/controllers/copy.controller.js";
import { CopyRepository } from "./modules/copies/repositories/copy.repository.js";
import { MemberController } from "./modules/members/controllers/member.controller.js";
import { MemberService, MembershipTypeService } from "./modules/members/services/member.service.js";
import { MemberRepository, MembershipEventRepository, MembershipTypeRepository } from "./modules/members/repositories/member.repository.js";
import { LoanRepository } from "./modules/circulation/repositories/loan.repository.js";
import { ReservationRepository } from "./modules/circulation/repositories/reservation.repository.js";
import { CopyAllocator } from "./modules/circulation/services/copy-allocator.js";
import { CirculationService } from "./modules/circulation/services/circulation.service.js";
import { ReservationService } from "./modules/circulation/services/reservation.service.js";
import { FineRepository } from "./modules/finance/repositories/fine.repository.js";
import { PaymentRepository } from "./modules/finance/repositories/payment.repository.js";
import { FineService } from "./modules/finance/services/fine.service.js";
import { PaymentService } from "./modules/finance/services/payment.service.js";
import { PaymentWebhookService } from "./modules/finance/services/payment-webhook.service.js";
import { TransferService } from "./modules/transfers/services/transfer.service.js";
import { TransferRepository } from "./modules/transfers/repositories/transfer.repository.js";
import { NotificationService } from "./modules/notifications/services/notification.service.js";
import { NotificationRepository } from "./modules/notifications/repositories/notification.repository.js";
import { ReminderService } from "./modules/notifications/services/reminder.service.js";
import { NotificationHub } from "./modules/notifications/services/notification-hub.js";
import { NotificationChangeStream } from "./modules/notifications/services/notification-change-stream.js";
import { OrderNotifier } from "./modules/orders/services/order-notifier.js";
import { PurchaseOrderService, SupplierService } from "./modules/acquisitions/services/acquisition.service.js";
import { PurchaseOrderRepository, SupplierRepository } from "./modules/acquisitions/repositories/acquisition.repository.js";
import { InventoryController } from "./modules/inventory/controllers/inventory.controller.js";
import { StocktakeRepository, StocktakeScanRepository } from "./modules/inventory/repositories/stocktake.repository.js";
import { StocktakeService } from "./modules/inventory/services/stocktake.service.js";
import { ReportService } from "./modules/reports/services/report.service.js";
import {
  EventService, RoomBookingService, RoomService,
} from "./modules/facilities/services/facility.service.js";
import { EventRegistrationRepository, EventRepository, RoomBookingRepository, RoomRepository } from "./modules/facilities/repositories/facility.repository.js";
import { DigitalLibraryService } from "./modules/digital/services/digital.service.js";
import { DigitalAccessLogRepository, DigitalPublicationRepository } from "./modules/digital/repositories/digital.repository.js";
import { MongoCatalogSearch } from "./modules/discovery/providers/mongo-catalog-search.js";
import { CatalogService } from "./modules/discovery/services/catalog.service.js";
import { CatalogAssistantService } from "./modules/assistant/services/assistant.service.js";
import { ClaudeCatalogModel } from "./modules/assistant/providers/claude-catalog-model.js";

/**
 * Composition root: builds the whole object graph once. This is the only place
 * that chooses concrete implementations; every class receives its collaborators
 * through its constructor (each takes the dependencies object and keeps only
 * what it names). `overrides` replaces collaborators, e.g. in tests.
 */
export function createContainer(config = env, overrides = {}) {
  const c = { config };
  const add = (entries) => Object.assign(c, entries, pick(overrides, Object.keys(entries)));

  // ---------- Infrastructure
  const publicFiles = new LocalFileStorage(path.join(config.uploadDir, "public"));
  const cloudinary = new CloudinaryImageStorage(config.cloudinary, config.appName);
  add({
    database: new Database(config.mongodbUri, { autoIndex: !config.isProduction }),
    transactionRunner: new TransactionRunner(),
    sequenceGenerator: new SequenceGenerator(),
    publicFileStorage: publicFiles,
    privateFileStorage: new LocalFileStorage(path.join(config.uploadDir, "private")),
    // Cloudinary when configured, else covers are stored next to the API.
    imageStorage: cloudinary.isConfigured ? cloudinary : new LocalImageStorage(publicFiles),
    paymentGateway: new StripePaymentGateway({ ...config.stripe, frontendUrl: config.frontendUrl }),
    mailer: config.mail.transport === "gmail" ? new GmailMailer(config.mail) : new LogMailer(),
    passwordHasher: new PasswordHasher(config.saltRounds),
    accessTokens: new JwtTokenService(config.tokenSignature),
    refreshTokens: new JwtTokenService(
      createHmac("sha256", config.tokenSignature).update("bookstore:refresh:v1").digest("hex")
    ),
    emailTokens: new JwtTokenService(config.emailToken),
  });

  // ---------- Repositories
  add({
    userRepository: new UserRepository(),
    authSessionRepository: new AuthSessionRepository(),
    bookRepository: new BookRepository(),
    categoryRepository: new CategoryRepository(),
    cartRepository: new CartRepository(),
    orderRepository: new OrderRepository(),
    couponRepository: new CouponRepository(),
    roleRepository: new RoleRepository(),
    auditLogRepository: new AuditLogRepository(),
    settingRepository: new SettingRepository(),
    branchRepository: new BranchRepository(),
    locationRepository: new LocationRepository(),
    authorRepository: new AuthorRepository(),
    publisherRepository: new PublisherRepository(),
    copyRepository: new CopyRepository(),
    memberRepository: new MemberRepository(),
    membershipTypeRepository: new MembershipTypeRepository(),
    membershipEventRepository: new MembershipEventRepository(),
    loanRepository: new LoanRepository(),
    reservationRepository: new ReservationRepository(),
    fineRepository: new FineRepository(),
    paymentRepository: new PaymentRepository(),
    transferRepository: new TransferRepository(),
    notificationRepository: new NotificationRepository(),
    supplierRepository: new SupplierRepository(),
    purchaseOrderRepository: new PurchaseOrderRepository(),
    stocktakeRepository: new StocktakeRepository(),
    stocktakeScanRepository: new StocktakeScanRepository(),
    roomRepository: new RoomRepository(),
    roomBookingRepository: new RoomBookingRepository(),
    eventRepository: new EventRepository(),
    eventRegistrationRepository: new EventRegistrationRepository(),
    digitalPublicationRepository: new DigitalPublicationRepository(),
    digitalAccessLogRepository: new DigitalAccessLogRepository(),
  });

  // ---------- Services (in dependency order)
  add({ auditService: new AuditService(c) });
  add({ settingsService: new SettingsService(c), roleService: new RoleService(c) });
  add({ notificationService: new NotificationService(c) });
  add({ notificationHub: new NotificationHub(c), orderNotifier: new OrderNotifier(c) });
  // Started by server.js once connected (needs a replica set).
  add({ notificationChangeStream: new NotificationChangeStream({ ...c, ...pick(overrides, ["notificationChangeSource"]) }) });
  add({
    emailConfirmationService: new EmailConfirmationService({ ...c, frontendUrl: config.frontendUrl }),
    fineService: new FineService(c),
    copyAllocator: new CopyAllocator(c),
    catalogSearchProvider: new MongoCatalogSearch(c),
  });
  add({
    authService: new AuthService({
      ...c,
      emailConfirmation: c.emailConfirmationService,
      authSessionRepository: c.authSessionRepository,
      requireEmailConfirmation: config.requireEmailConfirmation,
    }),
    userService: new UserService(c),
    bookService: new BookService(c),
    categoryService: new CategoryService(c),
    cartService: new CartService(c),
    orderService: new OrderService(c),
    branchService: new BranchService(c),
    locationService: new LocationService(c),
    authorService: new AuthorService(c),
    publisherService: new PublisherService(c),
    copyService: new CopyService(c),
    memberService: new MemberService(c),
    membershipTypeService: new MembershipTypeService(c),
    circulationService: new CirculationService(c),
    reservationService: new ReservationService(c),
    paymentService: new PaymentService(c),
    transferService: new TransferService(c),
    reminderService: new ReminderService(c),
    supplierService: new SupplierService(c),
    stocktakeService: new StocktakeService(c),
    reportService: new ReportService(c),
    roomService: new RoomService(c),
    roomBookingService: new RoomBookingService(c),
    digitalLibraryService: new DigitalLibraryService(c),
    catalogService: new CatalogService(c),
  });
  add({
    purchaseOrderService: new PurchaseOrderService(c),
    couponService: new CouponService(c),
    eventService: new EventService(c),
    paymentWebhookService: new PaymentWebhookService(c),
    catalogAssistantService: new CatalogAssistantService({
      ...c,
      catalogModel: config.assistant.apiKey
        ? new ClaudeCatalogModel({ apiKey: config.assistant.apiKey, model: config.assistant.model })
        : null,
    }),
  });

  // ---------- HTTP
  add({
    authGuard: new AuthGuard({ ...c, bearerKey: config.bearerKey }),
    // Brute-force protection for credentials, and a cap on assistant questions.
    authRateLimiter: rateLimit({ windowMs: 15 * 60_000, max: 50 }),
    assistantRateLimiter: rateLimit({ windowMs: 60_000, max: 10 }),
    authController: new AuthController(c.authService, c.emailConfirmationService, config),
    userController: new UserController(c.userService),
    bookController: new BookController(c.bookService),
    categoryController: new CategoryController(c.categoryService),
    cartController: new CartController(c.cartService),
    orderController: new OrderController(c.orderService),
    roleController: new RoleController(c.roleService),
    auditController: new AuditController(c.auditService),
    settingsController: new SettingsController(c.settingsService),
    copyController: new CopyController(c.copyService),
    memberController: new MemberController(c.memberService),
    inventoryController: new InventoryController(c.stocktakeService),
  });

  return c;
}

const pick = (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]]));
