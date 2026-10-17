import { env } from "./config/env.js";
import { Database } from "./infrastructure/database.js";
import { AuthGuard } from "./middleware/auth-guard.js";
import { GmailMailer } from "./infrastructure/gmail-mailer.js";
import { PasswordHasher } from "./security/password-hasher.js";
import { JwtTokenService } from "./security/jwt-token-service.js";
import { StripePaymentGateway } from "./infrastructure/stripe-payment-gateway.js";
import { CloudinaryImageStorage } from "./infrastructure/cloudinary-image-storage.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
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

/**
 * Composition root: builds the whole object graph once. This is the only place
 * that chooses concrete implementations; every class receives its collaborators
 * through its constructor.
 */
export function createContainer(config = env) {
  // Infrastructure
  const database = new Database(config.mongodbUri);
  const imageStorage = new CloudinaryImageStorage(config.cloudinary, config.appName);
  const paymentGateway = new StripePaymentGateway({ ...config.stripe, frontendUrl: config.frontendUrl });
  const mailer = new GmailMailer(config.mail);
  const passwordHasher = new PasswordHasher(config.saltRounds);
  const accessTokens = new JwtTokenService(config.tokenSignature);
  const emailTokens = new JwtTokenService(config.emailToken);

  // Repositories
  const userRepository = new UserRepository();
  const bookRepository = new BookRepository();
  const categoryRepository = new CategoryRepository();
  const cartRepository = new CartRepository();
  const orderRepository = new OrderRepository();

  // Services
  const authService = new AuthService({
    userRepository,
    passwordHasher,
    accessTokens,
    emailTokens,
    mailer,
    requireEmailConfirmation: config.requireEmailConfirmation,
    frontendUrl: config.frontendUrl,
  });
  const bookService = new BookService({ bookRepository, categoryRepository, imageStorage });
  const categoryService = new CategoryService({ categoryRepository });
  const cartService = new CartService({ cartRepository, bookRepository });
  const orderService = new OrderService({
    orderRepository,
    cartRepository,
    bookRepository,
    paymentGateway,
  });

  return {
    database,
    imageStorage,
    paymentGateway,
    mailer,
    accessTokens,
    emailTokens,
    userRepository,
    bookRepository,
    categoryRepository,
    cartRepository,
    orderRepository,
    authService,
    bookService,
    categoryService,
    cartService,
    orderService,
    authGuard: new AuthGuard({ bearerKey: config.bearerKey, accessTokens, userRepository }),
    authController: new AuthController(authService),
    bookController: new BookController(bookService),
    categoryController: new CategoryController(categoryService),
    cartController: new CartController(cartService),
    orderController: new OrderController(orderService),
  };
}
