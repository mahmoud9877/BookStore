import React from "react";
import ErrorPage from "../components/ErrorPage.jsx";
import RootLayout from "../layouts/RootLayout.jsx";
import CartPage from "../modules/cart/CartPage.jsx";
import HomePage from "../modules/books/HomePage.jsx";
import LoginPage from "../modules/auth/LoginPage.jsx";
import SignupPage from "../modules/auth/SignupPage.jsx";
import UsersPage from "../modules/users/UsersPage.jsx";
import RolesPage from "../modules/roles/RolesPage.jsx";
import ProfilePage from "../modules/profile/ProfilePage.jsx";
import ProtectedRoute from "../modules/auth/ProtectedRoute.jsx";
import BookDetailsPage from "../modules/books/BookDetailsPage.jsx";
import CategoriesPage from "../modules/categories/CategoriesPage.jsx";
import BooksDashboardPage from "../modules/books/BooksDashboardPage.jsx";
import AdminLayout from "../modules/admin/AdminLayout.jsx";
import OverviewPage from "../modules/admin/OverviewPage.jsx";
import { ADMIN_PERMISSIONS, sectionFor } from "../modules/admin/admin-sections.js";
import CirculationDeskPage from "../modules/circulation/CirculationDeskPage.jsx";
import LoansPage from "../modules/circulation/LoansPage.jsx";
import ReservationsPage from "../modules/circulation/ReservationsPage.jsx";
import MembersPage from "../modules/members/MembersPage.jsx";
import MemberDetailPage from "../modules/members/MemberDetailPage.jsx";
import FinesPage from "../modules/finance/FinesPage.jsx";
import CopiesPage from "../modules/copies/CopiesPage.jsx";
import AuthorsPublishersPage from "../modules/authors/AuthorsPublishersPage.jsx";
import DigitalAdminPage from "../modules/digital/DigitalAdminPage.jsx";
import TransfersPage from "../modules/transfers/TransfersPage.jsx";
import StocktakesPage from "../modules/inventory/StocktakesPage.jsx";
import AcquisitionsPage from "../modules/acquisitions/AcquisitionsPage.jsx";
import BranchesPage from "../modules/branches/BranchesPage.jsx";
import RoomsEventsPage from "../modules/facilities/RoomsEventsPage.jsx";
import ReportsPage from "../modules/reports/ReportsPage.jsx";
import AuditLogPage from "../modules/audit/AuditLogPage.jsx";
import SettingsPage from "../modules/settings/SettingsPage.jsx";
import AccountLayout from "../modules/account/AccountLayout.jsx";
import AccountOverviewPage from "../modules/account/AccountOverviewPage.jsx";
import MyLoansPage from "../modules/account/MyLoansPage.jsx";
import MyReservationsPage from "../modules/account/MyReservationsPage.jsx";
import MyFinesPage from "../modules/account/MyFinesPage.jsx";
import NotificationsPage from "../modules/account/NotificationsPage.jsx";
import MyBookingsPage from "../modules/account/MyBookingsPage.jsx";
import DigitalLibraryPage from "../modules/digital/DigitalLibraryPage.jsx";
import EventsPage from "../modules/facilities/EventsPage.jsx";

const signedIn = (element, permissions) => <ProtectedRoute permissions={permissions}>{element}</ProtectedRoute>;
const adminSection = (path, element, subpath = path) => ({ path: subpath, element: signedIn(element, sectionFor(path).permissions) });

export const routes = [
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      // Browsing is public; borrowing, buying and administration require an account.
      { index: true, element: <HomePage /> },
      { path: "book/:bookId", element: <BookDetailsPage /> },
      { path: "digital", element: <DigitalLibraryPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "cart", element: signedIn(<CartPage />) },
      { path: "profile", element: signedIn(<ProfilePage />) },
      {
        // The member's own library account (self-service).
        path: "account",
        element: signedIn(<AccountLayout />),
        children: [
          { index: true, element: <AccountOverviewPage /> },
          { path: "loans", element: <MyLoansPage /> },
          { path: "reservations", element: <MyReservationsPage /> },
          { path: "fines", element: <MyFinesPage /> },
          { path: "notifications", element: <NotificationsPage /> },
          { path: "bookings", element: <MyBookingsPage /> },
        ],
      },
      {
        // Each section is guarded by the permissions its API endpoints require.
        path: "dashboard",
        element: signedIn(<AdminLayout />, ADMIN_PERMISSIONS),
        children: [
          { index: true, element: <OverviewPage /> },
          adminSection("desk", <CirculationDeskPage />),
          adminSection("loans", <LoansPage />),
          adminSection("reservations", <ReservationsPage />),
          adminSection("members", <MembersPage />),
          adminSection("members", <MemberDetailPage />, "members/:memberId"),
          adminSection("fines", <FinesPage />),
          adminSection("books", <BooksDashboardPage />),
          adminSection("copies", <CopiesPage />),
          adminSection("categories", <CategoriesPage />),
          adminSection("authors", <AuthorsPublishersPage />),
          adminSection("digital", <DigitalAdminPage />),
          adminSection("transfers", <TransfersPage />),
          adminSection("stocktakes", <StocktakesPage />),
          adminSection("acquisitions", <AcquisitionsPage />),
          adminSection("branches", <BranchesPage />),
          adminSection("rooms", <RoomsEventsPage />),
          adminSection("reports", <ReportsPage />),
          adminSection("audit", <AuditLogPage />),
          adminSection("users", <UsersPage />),
          adminSection("roles", <RolesPage />),
          adminSection("settings", <SettingsPage />),
        ],
      },
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "*", element: <ErrorPage notFound /> },
    ],
  },
];
