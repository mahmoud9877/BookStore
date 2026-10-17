import React, { useState } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import { signupSchema } from "../../Utils/Validation.js"; // Assuming this is where your schema is located
import { useNavigate, Link } from "react-router-dom";
import { baseURL } from "../../index.js";
import "./Signup.css";
const Signup = () => {
  const navigate = useNavigate(); // Use hook for navigation
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(""); // State to store error messages
  const [user, setUser] = useState({
    userName: "",
    email: "",
    password: "",
  });

  // Handle input changes and update the user state
  function getData(eventInfo) {
    const { name, value } = eventInfo.target;
    setUser({ ...user, [name]: value });
  }

  // Function to validate form data using Joi
  function validationSignup() {
    const { userName, email, password, cPassword } = user;
    const result = signupSchema.validate(
      { userName, email, password, cPassword },
      { abortEarly: false }
    );
    if (result.error) {
      const errorMessages = result.error.details
        .map((detail) => detail.message)
        .join(", ");
      setError(errorMessages);
      return false; // Validation failed
    }
    return true; // Validation passed
  }

  // Function to send signup data to the server
  async function sendData() {
    try {
      const { data } = await axios.post(`${baseURL}/auth/signup`, user);

      // If the signup is successful, navigate to the login page
      if (data.message === "Done") {
        setIsLoading(false);
        navigate("/home"); // Redirect to login page only after signup succeeds
      } else {
        setIsLoading(false);
        setError(data.message); // Show error message if signup fails
      }
    } catch (err) {
      setIsLoading(false);
      setError("An error occurred during signup. Please try again.");
      console.error("Signup error:", err); // Log the error for debugging
    }
  }

  // Handle form submission
  function submitSignup(eventInfo) {
    eventInfo.preventDefault(); // Prevent form from refreshing the page
    setError(""); // Reset any previous errors

    // Validate form data before sending
    if (!validationSignup()) {
      setIsLoading(false);
      return; // Stop form submission if validation fails
    }

    setIsLoading(true); // Show loading spinner
    sendData(); // Call sendData to handle the signup request
  }

  return (
    <div>
      <Helmet>
        <meta charSet="utf-8" />
        <title>Signup</title>
        <link rel="canonical" href="" />
      </Helmet>
      {/* Show an alert if there's an error */}
      {error && <div className="alert alert-danger my-2">{error}</div>}

      <div className="d-flex justify-content-center py-1">
        <form className="form" method="post" onSubmit={submitSignup}>
          <h3 className="title d-flex justify-content-center">Sign-Up</h3>
          <div className="mb-2">
            <h6 className="pt-3 ">Name</h6>
            <input
              type="text"
              className="form-control pt-2"
              placeholder="Your Name"
              aria-label="Your Name"
              name="userName"
              onChange={getData}
            ></input>
          </div>
          <div className="mb-2">
            <h6>Email</h6>
            <input
              placeholder="Your Email"
              id="email"
              className="form-control"
              type="email"
              name="email"
              onChange={getData}
              required
            />
          </div>
          <div className="mb-2">
            <h6>Password</h6>
            <input
              placeholder="Password"
              id="password"
              className="form-control"
              type="password"
              name="password"
              onChange={getData}
              required
            />
          </div>
          <div className="mb-2">
            <h6>Confirm Password</h6>
            <input
              placeholder="Confirm Password"
              id="cPassword"
              className="form-control"
              type="password"
              name="cPassword"
              onChange={getData}
              required
            />
          </div>
          <div className="button d-flex justify-content-center">
            <button
              className="btn btn btn-outline-secondary py-2 w-50 bg-black"
              type="submit"
            >
              {isLoading ? (
                <div className="spinner-border text-light" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              ) : (
                "Sign Up"
              )}
            </button>
          </div>
          <p className="pt-4">
            Already have an account? <Link to="/login">Log-In</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
