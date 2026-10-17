import Home from "../Home/Home.jsx";
import Cart from "../Cart/Cart.jsx";
import Login from "../Login/Login.jsx";
import { jwtDecode } from "jwt-decode"; // Remove curly braces
import React, { useEffect } from "react";
import Signup from "../Signup/Signup.jsx";
import Dashboard from "../Dashboard/Dashboard.jsx";
import OfflineWarning from "../Offline/Offline.jsx";
import RootLayout from "../Rootlayout/RootLayout.jsx";
import { useUser } from "../../Context/UserContext.jsx"; // Use useUser instead of useUserContext
import BookDetails from "../BookDetails/BookDetails.jsx";
import ProtectedRoute from "../ProtectedRoute/ProtectedRoute.jsx";
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
