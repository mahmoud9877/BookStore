import React, { lazy, Suspense } from "react";
import ErrorPage from "../components/ErrorPage.jsx";
import RootLayout from "../layouts/RootLayout.jsx";
import PageLoader from "../components/ui/PageLoader.jsx";
import ProtectedRoute from "../modules/auth/components/ProtectedRoute.jsx";
import { ADMIN_PERMISSIONS, sectionFor } from "../modules/admin/constants/admin-sections.js";

// Every page is its own chunk: visitors download the landing page or the
// catalogue, not the whole staff workspace.
const LandingPage = lazy(() => import("../modules/landing/pages/LandingPage.jsx"));
const HomePage = lazy(() => import("../modules/books/pages/HomePage.jsx"));
const BookDetailsPage = lazy(() => import("../modules/books/pages/BookDetailsPage.jsx"));
const DigitalLibraryPage = lazy(() => import("../modules/digital/pages/DigitalLibraryPage.jsx"));
const EventsPage = lazy(() => import("../modules/facilities/pages/EventsPage.jsx"));
const CartPage = lazy(() => import("../modules/cart/pages/CartPage.jsx"));
const ProfilePage = lazy(() => import("../modules/profile/pages/ProfilePage.jsx"));
const LoginPage = lazy(() => import("../modules/auth/pages/LoginPage.jsx"));
const SignupPage = lazy(() => import("../modules/auth/pages/SignupPage.jsx"));
const AccountLayout = lazy(() => import("../modules/account/components/AccountLayout.jsx"));
const AccountOverviewPage = lazy(() => import("../modules/account/pages/AccountOverviewPage.jsx"));
const MyLoansPage = lazy(() => import("../modules/account/pages/MyLoansPage.jsx"));
const MyReservationsPage = lazy(() => import("../modules/account/pages/MyReservationsPage.jsx"));
const MyFinesPage = lazy(() => import("../modules/account/pages/MyFinesPage.jsx"));
const NotificationsPage = lazy(() => import("../modules/account/pages/NotificationsPage.jsx"));
const MyBookingsPage = lazy(() => import("../modules/account/pages/MyBookingsPage.jsx"));
const AppShell = lazy(() => import("../modules/admin/components/AppShell.jsx"));
const OverviewPage = lazy(() => import("../modules/admin/pages/OverviewPage.jsx"));
const CirculationDeskPage = lazy(() => import("../modules/circulation/pages/CirculationDeskPage.jsx"));
const LoansPage = lazy(() => import("../modules/circulation/pages/LoansPage.jsx"));
const ReservationsPage = lazy(() => import("../modules/circulation/pages/ReservationsPage.jsx"));
const MembersPage = lazy(() => import("../modules/members/pages/MembersPage.jsx"));
const MemberDetailPage = lazy(() => import("../modules/members/pages/MemberDetailPage.jsx"));
const FinesPage = lazy(() => import("../modules/finance/pages/FinesPage.jsx"));
const BooksDashboardPage = lazy(() => import("../modules/books/pages/BooksDashboardPage.jsx"));
const CopiesPage = lazy(() => import("../modules/copies/pages/CopiesPage.jsx"));
const CategoriesPage = lazy(() => import("../modules/categories/pages/CategoriesPage.jsx"));
const AuthorsPublishersPage = lazy(() => import("../modules/authors/pages/AuthorsPublishersPage.jsx"));
const DigitalAdminPage = lazy(() => import("../modules/digital/pages/DigitalAdminPage.jsx"));
const TransfersPage = lazy(() => import("../modules/transfers/pages/TransfersPage.jsx"));
const StocktakesPage = lazy(() => import("../modules/inventory/pages/StocktakesPage.jsx"));
const AcquisitionsPage = lazy(() => import("../modules/acquisitions/pages/AcquisitionsPage.jsx"));
const CouponsPage = lazy(() => import("../modules/coupons/pages/CouponsPage.jsx"));
const BranchesPage = lazy(() => import("../modules/branches/pages/BranchesPage.jsx"));
const RoomsEventsPage = lazy(() => import("../modules/facilities/pages/RoomsEventsPage.jsx"));
const ReportsPage = lazy(() => import("../modules/reports/pages/ReportsPage.jsx"));
const AuditLogPage = lazy(() => import("../modules/audit/pages/AuditLogPage.jsx"));
const UsersPage = lazy(() => import("../modules/users/pages/UsersPage.jsx"));
const RolesPage = lazy(() => import("../modules/roles/pages/RolesPage.jsx"));
const SettingsPage = lazy(() => import("../modules/settings/pages/SettingsPage.jsx"));

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
      adminSection("coupons", <CouponsPage />),
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
