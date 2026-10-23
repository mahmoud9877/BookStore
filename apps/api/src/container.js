import path from "node:path";
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
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { EmailConfirmationService } from "./modules/auth/email-confirmation.service.js";
import { UserService } from "./modules/users/user.service.js";
import { UserController } from "./modules/users/user.controller.js";
import { UserRepository } from "./modules/users/user.repository.js";
import { BookService } from "./modules/books/book.service.js";
import { BookController } from "./modules/books/book.controller.js";
import { BookRepository } from "./modules/books/book.repository.js";
import { CategoryService } from "./modules/categories/category.service.js";
import { CategoryController } from "./modules/categories/category.controller.js";
import { CategoryRepository } from "./modules/categories/category.repository.js";
import { CartService } from "./modules/cart/cart.service.js";
import { CartController } from "./modules/cart/cart.controller.js";
import { CartRepository } from "./modules/cart/cart.repository.js";
import { OrderService } from "./modules/orders/order.service.js";
import { OrderController } from "./modules/orders/order.controller.js";
import { OrderRepository } from "./modules/orders/order.repository.js";
import { CouponService } from "./modules/coupons/coupon.service.js";
import { CouponRepository } from "./modules/coupons/coupon.repository.js";
import { RoleService } from "./modules/roles/role.service.js";
import { RoleController } from "./modules/roles/role.controller.js";
import { RoleRepository } from "./modules/roles/role.repository.js";
import { AuditService } from "./modules/audit/audit.service.js";
import { AuditController } from "./modules/audit/audit.controller.js";
import { AuditLogRepository } from "./modules/audit/audit-log.repository.js";
import { SettingsService } from "./modules/settings/settings.service.js";
import { SettingsController } from "./modules/settings/settings.controller.js";
import { SettingRepository } from "./modules/settings/setting.repository.js";
import { BranchService, LocationService } from "./modules/branches/branch.service.js";
import { BranchRepository, LocationRepository } from "./modules/branches/branch.repository.js";
import { AuthorService } from "./modules/authors/author.service.js";
import { AuthorRepository } from "./modules/authors/author.repository.js";
import { PublisherService } from "./modules/publishers/publisher.service.js";
import { PublisherRepository } from "./modules/publishers/publisher.repository.js";
import { CopyService } from "./modules/copies/copy.service.js";
import { CopyController } from "./modules/copies/copy.controller.js";
import { CopyRepository } from "./modules/copies/copy.repository.js";
import { MemberController } from "./modules/members/member.controller.js";
import { MemberService, MembershipTypeService } from "./modules/members/member.service.js";
import { MemberRepository, MembershipEventRepository, MembershipTypeRepository } from "./modules/members/member.repository.js";
import { LoanRepository } from "./modules/circulation/loan.repository.js";
import { ReservationRepository } from "./modules/circulation/reservation.repository.js";
import { CopyAllocator } from "./modules/circulation/copy-allocator.js";
import { CirculationService } from "./modules/circulation/circulation.service.js";
import { ReservationService } from "./modules/circulation/reservation.service.js";
import { FineRepository } from "./modules/finance/fine.repository.js";
import { PaymentRepository } from "./modules/finance/payment.repository.js";
import { FineService } from "./modules/finance/fine.service.js";
import { PaymentService } from "./modules/finance/payment.service.js";
import { PaymentWebhookService } from "./modules/finance/payment-webhook.service.js";
import { TransferService } from "./modules/transfers/transfer.service.js";
import { TransferRepository } from "./modules/transfers/transfer.repository.js";
import { NotificationService } from "./modules/notifications/notification.service.js";
import { NotificationRepository } from "./modules/notifications/notification.repository.js";
import { ReminderService } from "./modules/notifications/reminder.service.js";
import { NotificationHub } from "./modules/notifications/notification-hub.js";
import { NotificationChangeStream } from "./modules/notifications/notification-change-stream.js";
import { OrderNotifier } from "./modules/orders/order-notifier.js";
import { PurchaseOrderService, SupplierService } from "./modules/acquisitions/acquisition.service.js";
import { PurchaseOrderRepository, SupplierRepository } from "./modules/acquisitions/acquisition.repository.js";
import { StocktakeRepository, StocktakeScanRepository, StocktakeService } from "./modules/inventory/stocktake.service.js";
import { ReportService } from "./modules/reports/report.service.js";
import {
  EventRegistrationRepository, EventRepository, EventService, RoomBookingRepository, RoomBookingService, RoomRepository, RoomService,
} from "./modules/facilities/facility.service.js";
import { DigitalAccessLogRepository, DigitalLibraryService, DigitalPublicationRepository } from "./modules/digital/digital.service.js";
import { MongoCatalogSearch } from "./modules/discovery/mongo-catalog-search.js";
import { CatalogService } from "./modules/discovery/catalog.service.js";
import { CatalogAssistantService } from "./modules/assistant/assistant.service.js";
import { ClaudeCatalogModel } from "./modules/assistant/claude-catalog-model.js";

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
    emailTokens: new JwtTokenService(config.emailToken),
  });

  // ---------- Repositories
  add({
    userRepository: new UserRepository(),
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
    authController: new AuthController(c.authService, c.emailConfirmationService),
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
  });

  return c;
}

const pick = (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, object[key]]));
