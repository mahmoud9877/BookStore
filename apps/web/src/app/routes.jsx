import React from "react";
import ErrorPage from "../components/ErrorPage.jsx";
import RootLayout from "../layouts/RootLayout.jsx";
import CartPage from "../modules/cart/CartPage.jsx";
import HomePage from "../modules/books/HomePage.jsx";
import LoginPage from "../modules/auth/LoginPage.jsx";
import SignupPage from "../modules/auth/SignupPage.jsx";
import { USER_ROLES } from "../modules/auth/UserContext.jsx";
import ProfilePage from "../modules/profile/ProfilePage.jsx";
import ProtectedRoute from "../modules/auth/ProtectedRoute.jsx";
import BookDetailsPage from "../modules/books/BookDetailsPage.jsx";
import BooksDashboardPage from "../modules/books/BooksDashboardPage.jsx";

const signedIn = (element, role) => <ProtectedRoute role={role}>{element}</ProtectedRoute>;

export const routes = [
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      // Browsing is public; buying and administration require an account.
      { index: true, element: <HomePage /> },
      { path: "book/:bookId", element: <BookDetailsPage /> },
      { path: "cart", element: signedIn(<CartPage />) },
      { path: "profile", element: signedIn(<ProfilePage />) },
      { path: "dashboard", element: signedIn(<BooksDashboardPage />, USER_ROLES.Admin) },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "*", element: <ErrorPage notFound /> },
    ],
  },
];
