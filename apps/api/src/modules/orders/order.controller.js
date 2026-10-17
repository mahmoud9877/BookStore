import cartModel from "../cart/cart.model.js";
import bookModel from "../books/book.model.js";
import orderModel, { ORDER_STATUSES } from "./order.model.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import {
  constructWebhookEvent,
  createCheckoutSession,
  isStripeConfigured,
} from "../../infrastructure/stripe.js";

const restoreStock = (items) =>
  Promise.all(
    items.map(({ bookId, quantity }) =>
      bookModel.updateOne({ _id: bookId }, { $inc: { quantity } })
    )
  );

/**
 * Atomically reserves stock for every cart item. If any item is unavailable,
 * already-reserved items are released and an error is thrown.
 */
async function reserveStock(cartItems) {
  const reserved = [];
  for (const item of cartItems) {
    const book = await bookModel.findOneAndUpdate(
      { _id: item.bookId, quantity: { $gte: item.quantity } },
      { $inc: { quantity: -item.quantity } }
    );
    if (!book) {
      await restoreStock(reserved);
      throw new Error(
        `Book unavailable or out of stock: ${item.bookTitle ?? item.bookId}`,
        { cause: 400 }
      );
    }
    reserved.push({
      bookId: book._id,
      bookTitle: book.bookTitle,
      quantity: item.quantity,
      unitPrice: book.price,
      finalPrice: book.price * item.quantity,
    });
  }
  return reserved;
}

export const createOrder = asyncHandler(async (req, res, next) => {
  const { address, phone, note, paymentType = "cash" } = req.body;
  const userId = req.user._id;

  if (paymentType === "card" && !isStripeConfigured()) {
    return next(new Error("Card payments are not configured", { cause: 503 }));
  }

  const cart = await cartModel.findOne({ userId });
  if (!cart?.books?.length) {
    return next(new Error("Empty Cart", { cause: 400 }));
  }

  const orderItems = await reserveStock(cart.books);
  const subtotal = orderItems.reduce((sum, item) => sum + item.finalPrice, 0);

  let order;
  try {
    order = await orderModel.create({
      userId,
      address,
      note,
      phone,
      books: orderItems,
      subtotal,
      finalPrice: subtotal,
      paymentType,
      status: paymentType === "card" ? ORDER_STATUSES.waitPayment : ORDER_STATUSES.placed,
    });
  } catch (error) {
    await restoreStock(orderItems);
    throw error;
  }

  let session;
  if (paymentType === "card") {
    try {
      session = await createCheckoutSession({
        customer_email: req.user.email,
        metadata: { orderId: order._id.toString() },
        line_items: orderItems.map((item) => ({
          price_data: {
            currency: "egp",
            product_data: { name: item.bookTitle || "Unknown Book" },
            unit_amount: Math.round(item.unitPrice * 100),
          },
          quantity: item.quantity,
        })),
      });
    } catch (error) {
      console.error("Stripe session creation failed:", error.message);
      await orderModel.updateOne({ _id: order._id }, { status: ORDER_STATUSES.rejected });
      await restoreStock(orderItems);
      throw new Error("Stripe session creation failed", { cause: 502 });
    }
  }

  await cartModel.updateOne({ userId }, { $set: { books: [] } });

  if (session) {
    return res.status(201).json({ message: "Order created", session, url: session.url });
  }
  return res.status(201).json({ message: "Order created successfully", order });
});

const CHECKOUT_FAILURE_EVENTS = [
  "checkout.session.expired",
  "checkout.session.async_payment_failed",
];

/** Stripe webhook. Mounted in app.js with a raw body parser (signature verification needs it). */
export const stripeWebhook = asyncHandler(async (req, res) => {
  let event;
  try {
    event = constructWebhookEvent(req.body, req.headers["stripe-signature"]);
  } catch (error) {
    if (error.cause === 503) throw error;
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  const orderId = event.data?.object?.metadata?.orderId;
  if (!orderId) {
    return res.json({ message: "Ignored" });
  }
  if (event.type === "checkout.session.completed") {
    await orderModel.updateOne({ _id: orderId }, { status: ORDER_STATUSES.placed });
    return res.json({ message: "Done" });
  }
  if (CHECKOUT_FAILURE_EVENTS.includes(event.type)) {
    await orderModel.updateOne({ _id: orderId }, { status: ORDER_STATUSES.rejected });
    return res.json({ message: "rejected link" });
  }
  return res.json({ message: "Ignored" });
});

export const cancelOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const order = await orderModel.findOne({ _id: orderId, userId: req.user._id });
  if (!order) {
    return next(new Error("In-Valid OrderId", { cause: 400 }));
  }
  const cancellable =
    (order.paymentType === "cash" && order.status === ORDER_STATUSES.placed) ||
    (order.paymentType === "card" && order.status === ORDER_STATUSES.waitPayment);
  if (!cancellable) {
    return next(
      new Error(`Cannot cancel your order after it been changed to ${order.status}`, {
        cause: 400,
      })
    );
  }

  await orderModel.updateOne(
    { _id: orderId, userId: req.user._id },
    { status: ORDER_STATUSES.canceled, updatedBy: req.user._id, reason }
  );
  await restoreStock(order.books);
  return res.status(200).json({ message: "Done", order });
});

export const deliverOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const order = await orderModel.findById(orderId);
  if (!order) {
    return next(new Error("Invalid order", { cause: 400 }));
  }

  const finalStatuses = [
    ORDER_STATUSES.waitPayment,
    ORDER_STATUSES.canceled,
    ORDER_STATUSES.rejected,
    ORDER_STATUSES.delivered,
  ];
  if (finalStatuses.includes(order.status)) {
    return next(
      new Error("Cannot update your order after it has been changed", { cause: 400 })
    );
  }

  order.status = ORDER_STATUSES.delivered;
  order.updatedBy = req.user._id;
  await order.save();
  return res.status(200).json({ message: "Order delivered successfully", order });
});
