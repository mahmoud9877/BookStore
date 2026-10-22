import React, { lazy, Suspense } from "react";
import ErrorPage from "../components/ErrorPage.jsx";
import RootLayout from "../layouts/RootLayout.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import ProtectedRoute from "../modules/auth/ProtectedRoute.jsx";
import { ADMIN_PERMISSIONS, sectionFor } from "../modules/admin/admin-sections.js";

// Every page is its own chunk: visitors download the landing page or the
// catalogue, not the whole staff workspace.
const LandingPage = lazy(() => import("../modules/landing/LandingPage.jsx"));
const HomePage = lazy(() => import("../modules/books/HomePage.jsx"));
const BookDetailsPage = lazy(() => import("../modules/books/BookDetailsPage.jsx"));
const DigitalLibraryPage = lazy(() => import("../modules/digital/DigitalLibraryPage.jsx"));
const EventsPage = lazy(() => import("../modules/facilities/EventsPage.jsx"));
const CartPage = lazy(() => import("../modules/cart/CartPage.jsx"));
const ProfilePage = lazy(() => import("../modules/profile/ProfilePage.jsx"));
const LoginPage = lazy(() => import("../modules/auth/LoginPage.jsx"));
const SignupPage = lazy(() => import("../modules/auth/SignupPage.jsx"));
const AccountLayout = lazy(() => import("../modules/account/AccountLayout.jsx"));
const AccountOverviewPage = lazy(() => import("../modules/account/AccountOverviewPage.jsx"));
const MyLoansPage = lazy(() => import("../modules/account/MyLoansPage.jsx"));
const MyReservationsPage = lazy(() => import("../modules/account/MyReservationsPage.jsx"));
const MyFinesPage = lazy(() => import("../modules/account/MyFinesPage.jsx"));
const NotificationsPage = lazy(() => import("../modules/account/NotificationsPage.jsx"));
const MyBookingsPage = lazy(() => import("../modules/account/MyBookingsPage.jsx"));
const AppShell = lazy(() => import("../modules/admin/AppShell.jsx"));
const OverviewPage = lazy(() => import("../modules/admin/OverviewPage.jsx"));
const CirculationDeskPage = lazy(() => import("../modules/circulation/CirculationDeskPage.jsx"));
const LoansPage = lazy(() => import("../modules/circulation/LoansPage.jsx"));
const ReservationsPage = lazy(() => import("../modules/circulation/ReservationsPage.jsx"));
const MembersPage = lazy(() => import("../modules/members/MembersPage.jsx"));
const MemberDetailPage = lazy(() => import("../modules/members/MemberDetailPage.jsx"));
const FinesPage = lazy(() => import("../modules/finance/FinesPage.jsx"));
const BooksDashboardPage = lazy(() => import("../modules/books/BooksDashboardPage.jsx"));
const CopiesPage = lazy(() => import("../modules/copies/CopiesPage.jsx"));
const CategoriesPage = lazy(() => import("../modules/categories/CategoriesPage.jsx"));
const AuthorsPublishersPage = lazy(() => import("../modules/authors/AuthorsPublishersPage.jsx"));
const DigitalAdminPage = lazy(() => import("../modules/digital/DigitalAdminPage.jsx"));
const TransfersPage = lazy(() => import("../modules/transfers/TransfersPage.jsx"));
const StocktakesPage = lazy(() => import("../modules/inventory/StocktakesPage.jsx"));
const AcquisitionsPage = lazy(() => import("../modules/acquisitions/AcquisitionsPage.jsx"));
const BranchesPage = lazy(() => import("../modules/branches/BranchesPage.jsx"));
const RoomsEventsPage = lazy(() => import("../modules/facilities/RoomsEventsPage.jsx"));
const ReportsPage = lazy(() => import("../modules/reports/ReportsPage.jsx"));
const AuditLogPage = lazy(() => import("../modules/audit/AuditLogPage.jsx"));
const UsersPage = lazy(() => import("../modules/users/UsersPage.jsx"));
const RolesPage = lazy(() => import("../modules/roles/RolesPage.jsx"));
const SettingsPage = lazy(() => import("../modules/settings/SettingsPage.jsx"));

const signedIn = (element, permissions) => <ProtectedRoute permissions={permissions}>{element}</ProtectedRoute>;
const adminSection = (path, element, subpath = path) => ({ path: subpath, element: signedIn(element, sectionFor(path).permissions) });
const standalone = (element) => <Suspense fallback={<PageLoader />}>{element}</Suspense>;

export const routes = [
  // The product page has its own header and footer.
  { path: "/", element: standalone(<LandingPage />), errorElement: <ErrorPage /> },
  {
    // The staff workspace has its own shell (sidebar + top bar).
    path: "/dashboard",
    element: signedIn(standalone(<AppShell />), ADMIN_PERMISSIONS),
    errorElement: <ErrorPage />,
    children: [
      // Each section is guarded by the permissions its API endpoints require.
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
  {
    // Public catalogue, member portal and sign-in share the site header and footer.
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "catalog", element: <HomePage /> },
      { path: "book/:bookId", element: <BookDetailsPage /> },
      { path: "digital", element: <DigitalLibraryPage /> },
      { path: "events", element: <EventsPage /> },
      { path: "cart", element: signedIn(<CartPage />) },
      { path: "profile", element: signedIn(<ProfilePage />) },
      {
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
      { path: "login", element: <LoginPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "*", element: <ErrorPage notFound /> },
    ],
  },
];
