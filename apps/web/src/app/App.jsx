import Home from "../modules/books/HomePage.jsx";
import Cart from "../modules/cart/CartPage.jsx";
import Login from "../modules/auth/LoginPage.jsx";
import { jwtDecode } from "jwt-decode"; // Remove curly braces
import React, { useEffect } from "react";
import Signup from "../modules/auth/SignupPage.jsx";
import Dashboard from "../modules/books/BooksDashboardPage.jsx";
import OfflineWarning from "../components/OfflineWarning.jsx";
import RootLayout from "../layouts/RootLayout.jsx";
import { useUser } from "../modules/auth/UserContext.jsx"; // Use useUser instead of useUserContext
import BookDetails from "../modules/books/BookDetailsPage.jsx";
import ProtectedRoute from "../modules/auth/ProtectedRoute.jsx";
import { createHashRouter, RouterProvider } from "react-router-dom"; // ✅ فقط دول اللي محتاجهم

function App() {
  const { userData, setUserData } = useUser();

  useEffect(() => {
    const token = localStorage.getItem("userToken");

    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUserData({ ...decodedToken, token });
      } catch (error) {
        console.error("Invalid token:", error);
        setUserData(null);
      }
    }
  }, [setUserData]);

  const routers = createHashRouter([
    {
      path: "/",
      element: <RootLayout userData={userData} />,
      children: [
        {
          index: true,
          element: (
            <ProtectedRoute userData={userData}>
              <Home userData={userData} />
            </ProtectedRoute>
          ),
        },
        {
          path: "dashboard",
          element: (
            <ProtectedRoute userData={userData}>
              <Dashboard />
            </ProtectedRoute>
          ),
        },
        {
          path: "cart",
          element: (
            <ProtectedRoute userData={userData}>
              <Cart userData={userData} />
            </ProtectedRoute>
          ),
        },
        {
          path: "book/:bookId",
          element: (
            <ProtectedRoute userData={userData}>
              <BookDetails />
            </ProtectedRoute>
          ),
        },
        { path: "login", element: <Login /> },
        { path: "signup", element: <Signup /> },
      ],
    },
  ]);

  return (
    <>
      <div>
        <OfflineWarning />
        <RouterProvider router={routers} />
      </div>
    </>
  );
}

export default App;
