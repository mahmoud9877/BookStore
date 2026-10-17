import { asyncHandler } from "../../../utils/errorHandling.js";
import BookModel from "../../../../DB/modules/bookModel.js";
import orderModel from "../../../../DB/modules/OrderModel.js";
import payment from "../../../utils/payment.js";
import cartModel from "../../../../DB/modules/cartModel.js";
import Stripe from "stripe";

export const createOrder = asyncHandler(async (req, res, next) => {
  const { address, phone, note, paymentType } = req.body;
  const userId = req.user._id;

  // Fetch the user's cart
  const cart = await cartModel.findOne({ userId });
  if (!cart || !cart.books?.length) {
    return next(new Error("Empty Cart", { cause: 400 }));
  }

  const finalBookList = [];
  let subtotal = 0;
  console.log(cart.books);

  // Validate books and calculate subtotal
  try {
    for (let cartBook of cart.books) {
      const book = await BookModel.findByIdAndUpdate({
        _id: cartBook.bookId,
        stock: { $gte: cartBook.quantity },
        isDeleted: false,
      });

      if (book == null) {
        return next(new Error(`Invalid book ${cartBook.cart}`, { cause: 400 }));
      }

      // Add book details to the order
      const bookDetails = {
        bookTitle: book.bookTitle, // Use book title from your schema
        bookId: book._id,
        quantity: cartBook.quantity,
        unitPrice: book.price, // Make sure to use the correct price field
        finalPrice: book.price * cartBook.quantity,
      };
      finalBookList.push(bookDetails);
      subtotal += bookDetails.finalPrice;
    }
  } catch (error) {
    return next(new Error("Book validation failed", { cause: 500 }));
  }

  // Calculate the final price (assuming no discount)
  const finalPrice = subtotal;

  // Create the order
  let order;
  try {
    order = await orderModel.create({
      userId,
      address,
      note,
      phone,
      books: finalBookList,
      subtotal,
      finalPrice,
      paymentType,
      status: paymentType === "card" ? "waitPayment" : "placed",
    });
  } catch (error) {
    if (error.errno === 11000) {
      // Handle duplicate key error
      console.error(
        "Duplicate key error: An entry with the same unique key already exists."
      );
    }

    console.error("Order creation failed:", error.message); // Log the specific error message
    return next(new Error("Order creation failed", { cause: 500 }));
  }

  // Update book stock in parallel
  try {
    await Promise.all(
      cart.books.map((cartBook) =>
        BookModel.updateOne(
          { _id: cartBook.bookId },
          { $inc: { stock: -Number(cartBook.quantity) } }
        )
      )
    );
  } catch (error) {
    return next(new Error("Stock update failed", { cause: 500 }));
  }

  // Clear the cart
  try {
    await cartModel.updateOne(
      { userId },
      { $set: { books: [] } } // or you can also delete the cart if needed
    );
  } catch (error) {
    return next(new Error("Cart update failed", { cause: 500 }));
  }

  // Handle Stripe payment if paymentType is 'card'
  if (paymentType === "card") {
    try {
      // Initialize Stripe with the secret key
      const stripe = new Stripe(process.env.SECRET_KEY); // Ensure the environment variable is correctly named and accessible

      // Create a payment session
      const session = await payment({
        stripe,
        customer_email: req.user.email,
        metadata: { orderId: order._id.toString() },
        cancel_url: `${req.protocol}://${
          req.headers.host
        }/order/cancel?orderId=${order._id.toString()}`,
        line_items: finalBookList.map((book) => ({
          price_data: {
            currency: "egp",
            product_data: {
              name: book.bookTitle || "Unknown Book", // Fallback for book title
            },
            unit_amount: book.unitPrice * 100, // Ensure unitPrice is in the correct format
          },
          quantity: book.quantity,
        })),
      });

      // Ensure the session has a URL to redirect to
      const url = session.url; // Get the URL from the session

      // Respond with a success message and session URL
      return res.status(201).json({ message: "Order created", session, url });
    } catch (error) {
      console.error("Error creating Stripe session:", error); // Log the error for debugging
      return next(
        new Error("Stripe session creation failed", {
          cause: error,
          statusCode: 500,
        })
      );
    }
  }

  // For non-card payments, return success response
  return res.status(201).json({ message: "Order created successfully", order });
});

export const webhook = asyncHandler(async (req, res, next) => {
  const stripe = new Stripe(process.env.Secret_Key);
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.endpointSecret
    );
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  const { orderId } = event.data.object.metadata;
  if (event.type != "checkout.session.completed") {
    await orderModel.updateOne({ _id: orderId }, { status: "rejected" });
    return res.json({ message: "rejected link" });
  }
  await orderModel.updateOne({ _id: orderId }, { status: "placed" });
  return res.json({ message: "Done" });
});

export const cancelOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const { reason } = req.body;
  const order = await orderModel.findOne({
    _id: orderId,
    userId: req.user._id,
  });
  if (!order) {
    return next(new Error("In-Valid OrderId", { cause: 400 }));
  }
  if (
    (order.status != "placed" && order.paymentType == "cash") ||
    (order.status != "waitPayment" && order.paymentType == "card")
  ) {
    return next(
      new Error(
        `Cannot cancel your order after it been changed to ${order.status}`,
        {
          cause: 400,
        }
      )
    );
  }
  await orderModel.updateOne(
    { _id: orderId, userId: req.user._id },
    { status: "canceled", updateBy: req.user._id, reason }
  );

  for (let book of order.books) {
    await BookModel.updateOne(
      { _id: book.bookId },
      { $inc: { stock: parseInt(book.quantity) } }
    );
  }
  if (order.couponId) {
    await couponModel.updateOne(
      { _id: order.couponId },
      { $pull: { usedBy: req.user._id } }
    );
  }
  return res.status(200).json({ message: "Done", order });
});

export const deliveredOrder = asyncHandler(async (req, res, next) => {
  const { orderId } = req.params;
  const order = await orderModel.findOne({
    _id: orderId,
  });

  if (!order) {
    return next(new Error("Invalid order", { cause: 400 }));
  }

  if (
    ["waitPayment", "canceled", "rejected", "delivered"].includes(order.status)
  ) {
    return next(
      new Error("Cannot update your order after it has been changed", {
        cause: 400,
      })
    );
  }

  await orderModel.updateOne(
    { _id: orderId },
    { status: "canceled", updatedBy: req.user._id }
  );

  return res
    .status(200)
    .json({ message: "Order canceled successfully", order });
});
