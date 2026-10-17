import { Navigate } from "react-router-dom";

function ProtectedRoute(props) {
  // Check if user is authenticated
  if (!localStorage.getItem("userToken")) {
    return <Navigate to="/login" />;
  } else {
    return props.children;
  }
  // If user is authenticated, render the children components
}

export default ProtectedRoute;
