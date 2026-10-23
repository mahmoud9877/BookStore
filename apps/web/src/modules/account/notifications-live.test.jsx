import React from "react";
import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "./NotificationBell.jsx";
import useNotificationStream from "./useNotificationStream.js";
import { notificationText } from "./notification-text.js";
import { accountKeys } from "./account.queries.js";
import { openEventStream } from "../../lib/event-stream.js";
import { apiClient } from "../../lib/api-client.js";
import { useAuthStore } from "../auth/auth.store.js";
import { useToastStore } from "../../components/ui/toast.store.js";
import { fakeApi, renderPage } from "../../test-utils/render-page.jsx";
import { createQueryWrapper } from "../../test-utils/query-wrapper.jsx";
import { makeToken } from "../../test-utils/make-token.js";
import { resetStores } from "../../test-utils/reset-stores.js";

jest.mock("../../lib/api-client.js", () => {
  const actual = jest.requireActual("../../lib/api-client.js");
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() } };
});
jest.mock("../../lib/event-stream.js", () => ({ ...jest.requireActual("../../lib/event-stream.js"), openEventStream: jest.fn() }));

const MEMBER = { claims: { id: "u1", role: "User", userName: "reader" } };

describe("notificationText", () => {
  const cases = [
    ["order.placed", { reference: "A1B2C3", total: 320 }, "Order placed", "Your order #A1B2C3 for EGP 320 has been placed.", "/cart"],
    ["order.payment_confirmed", { reference: "A1B2C3", total: 320 }, "Payment received", "We received your payment for order #A1B2C3.", "/cart"],
    ["order.payment_failed", { reference: "A1B2C3" }, "Payment failed", "The payment for order #A1B2C3 didn't go through, so the order was cancelled.", "/cart"],
    ["order.delivered", { reference: "A1B2C3" }, "Order delivered", "Your order #A1B2C3 has been delivered.", "/cart"],
    ["order.cancelled", { reference: "A1B2C3" }, "Order cancelled", "Your order #A1B2C3 has been cancelled.", "/cart"],
    ["order.new", { reference: "A1B2C3", total: 12.5, customerName: "Sara" }, "New order", "Sara placed order #A1B2C3 for EGP 12.5.", "/dashboard"],
    ["stock.low", { bookId: "b1", title: "the hobbit", quantity: 2 }, "Low stock", "Only 2 left of “The Hobbit”.", "/dashboard/books"],
  ];
  test.each(cases)("%s", (type, data, title, body, link) => {
    const text = notificationText({ type, data, subject: "stored", body: "stored" });
    expect({ ...text, body: text.body.replace(/\s/g, " ") }).toEqual({ title, body, link });
  });

  test("library notifications keep their stored subject and body", () => {
    expect(notificationText({ type: "loan.due_soon", subject: "Due soon", body: "Return it.", data: { title: "x" } })).toEqual({ title: "Due soon", body: "Return it.", link: null });
  });

  test("a shop notification without its data falls back to the stored text", () => {
    expect(notificationText({ type: "order.delivered", subject: "Order delivered", body: "Stored body" })).toEqual({ title: "Order delivered", body: "Stored body", link: "/cart" });
  });
});

describe("useNotificationStream", () => {
  let stream;
  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    resetStores();
    localStorage.setItem("userToken", makeToken({ id: "u1" }));
    useAuthStore.getState().syncFromStorage();
    stream = null;
    openEventStream.mockReset();
    openEventStream.mockImplementation((request) => {
      stream = request;
      request.onOpen();
      return new Promise((resolve, reject) => {
        request.signal.addEventListener("abort", () => reject(new Error("aborted")));
      });
    });
  });
  afterEach(() => jest.useRealTimers());

  const emit = (event, data) => act(() => stream.onEvent({ event, data: JSON.stringify(data) }));

  test("connects with the session token, updates the count and toasts a new notification", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidate = jest.spyOn(queryClient, "invalidateQueries");
    renderHook(() => useNotificationStream(), { wrapper });
    expect(openEventStream).toHaveBeenCalledTimes(1);
    expect(stream.url).toMatch(/\/notifications\/stream$/);
    expect(stream.headers.authorization).toBe(`Hamada__${useAuthStore.getState().user.token}`);

    emit("unread", { unread: 4 });
    expect(queryClient.getQueryData(accountKeys.unreadNotifications())).toBe(4);

    emit("notification", { _id: "n1", type: "order.delivered", data: { orderId: "o1", reference: "ABC123" }, subject: "Order delivered", body: "x", readAt: null });
    const [shown] = useToastStore.getState().toasts;
    expect(shown.type).toBe("info");
    const { container } = render(shown.message);
    expect(container).toHaveTextContent("Order deliveredYour order #ABC123 has been delivered.");
    expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: accountKeys.notifications() }));

    emit("unread", { unread: 5 });
    expect(queryClient.getQueryData(accountKeys.unreadNotifications())).toBe(5);
  });

  test("stops on sign-out", () => {
    const { wrapper } = createQueryWrapper();
    renderHook(() => useNotificationStream(), { wrapper });
    const { signal } = stream;
    act(() => useAuthStore.getState().signOut());
    expect(signal.aborted).toBe(true);
    act(() => jest.advanceTimersByTime(60_000));
    expect(openEventStream).toHaveBeenCalledTimes(1);
  });

  test("does not reconnect after 401", async () => {
    openEventStream.mockImplementation(async () => {
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    });
    const { wrapper } = createQueryWrapper();
    renderHook(() => useNotificationStream(), { wrapper });
    await act(async () => {
      await Promise.resolve();
      jest.advanceTimersByTime(120_000);
    });
    expect(openEventStream).toHaveBeenCalledTimes(1);
  });

  test("does nothing while signed out", () => {
    act(() => useAuthStore.getState().signOut());
    const { wrapper } = createQueryWrapper();
    renderHook(() => useNotificationStream(), { wrapper });
    expect(openEventStream).not.toHaveBeenCalled();
  });
});

describe("NotificationBell", () => {
  const ITEMS = [
    { _id: "n1", type: "order.placed", data: { reference: "ABC123", total: 320 }, subject: "Order placed", body: "x", readAt: null, createdAt: "2026-10-22T10:00:00Z" },
    { _id: "n2", type: "loan.due_soon", subject: "Your loan is due soon", body: "Return “Dune” by Friday.", readAt: "2026-10-21T10:00:00Z", createdAt: "2026-10-20T10:00:00Z" },
  ];
  const posts = [];
  beforeEach(() => {
    posts.length = 0;
    Object.assign(
      apiClient,
      fakeApi({
        "GET /notifications/me": ({ params }) => ({ data: params.unreadOnly ? [] : ITEMS, meta: {}, unread: 1 }),
        "POST /notifications/me/read": ({ body }) => {
          posts.push(body);
          return { data: { updated: 1 } };
        },
      })
    );
  });

  test("opens a dropdown with the latest notifications and marks all as read", async () => {
    renderPage(<NotificationBell />, { path: "/", ...MEMBER });
    const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    userEvent.click(bell);
    await waitFor(() => expect(bell).toHaveAttribute("aria-expanded", "true"));
    const list = await screen.findByRole("list", { name: "Latest notifications" });
    const [first, second] = within(list).getAllByRole("button");
    expect(first).toHaveTextContent(/Unread:\s*Order placed/);
    expect(first).toHaveTextContent("Your order #ABC123 for EGP 320 has been placed.");
    expect(first).toHaveClass("is-unread");
    expect(second).not.toHaveClass("is-unread");
    expect(screen.getByRole("link", { name: "See all notifications" })).toHaveAttribute("href", "/account/notifications");

    userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    await waitFor(() => expect(posts).toEqual([{}]));
  });

  test("clicking an unread item marks it read; Escape closes the dropdown", async () => {
    renderPage(<NotificationBell />, { path: "/", ...MEMBER });
    const bell = await screen.findByRole("button", { name: /Notifications/ });
    userEvent.click(bell);
    await screen.findByRole("list", { name: "Latest notifications" });
    userEvent.keyboard("{Escape}");
    await waitFor(() => expect(bell).toHaveAttribute("aria-expanded", "false"));

    userEvent.click(bell);
    const list = await screen.findByRole("list", { name: "Latest notifications" });
    userEvent.click(within(list).getAllByRole("button")[0]);
    await waitFor(() => expect(posts).toEqual([{ ids: ["n1"] }]));
    await waitFor(() => expect(screen.queryByRole("list", { name: "Latest notifications" })).not.toBeInTheDocument());
  });
});
