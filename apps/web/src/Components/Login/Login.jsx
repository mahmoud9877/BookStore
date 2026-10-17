import Joi from "joi";
import axios from "axios";
import { Helmet } from "react-helmet";
import React, { useState } from "react";
import { baseURL } from "../../index.js";
import { Link, useNavigate } from "react-router-dom";

const Login = ({ saveUserData }) => {
  let navigate = useNavigate();
  const [errorList, setErrorList] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState({
    email: "",
    password: "",
  });

  // Define Joi schema for validation
  const validationLoginForm = Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required()
      .label("Email"),
    password: Joi.string().min(6).required().label("Password"),
  });

  function getData(eventInfo) {
    let myUser = { ...user };
    myUser[eventInfo.target.name] = eventInfo.target.value;
    setUser(myUser);

    // Reset error states when user starts typing
    setError("");
    setErrorList([]);
  }

  async function sendData() {
    try {
      const { data } = await axios.post(`${baseURL}/auth/login`, user);
      console.log(data);

      // Check for different responses from the backend
      if (data.message === "Done") {
        const roleUser = data.role; // Get the user role from response
        const token = data.token; // Extract the token
        localStorage.setItem("userToken", token); // Store token in localStorage
        // Save user data including role
        saveUserData(token, roleUser); // Pass the token and role to saveUserData
        navigate("/home"); // Redirect to home page
      } else {
        setError(
          data.message === "Wrong Password"
            ? "Wrong password or email"
            : data.message
        );
      }
    } catch (err) {
      setError("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false); // Ensure loading state is reset
    }
  }

  function handleSubmit(event) {
    event.preventDefault(); // Prevent default form submission
    setIsLoading(true); // Set loading state to true

    // Perform validation on user input
    let validation = validationLoginForm.validate(user, { abortEarly: false });

    if (validation.error) {
      setIsLoading(false); // Stop loading if there's a validation error
      setErrorList(validation.error.details);
    } else {
      sendData(); // Call the sendData function
    }
  }

  return (
    <div className="d-flex justify-content-center py-4">
      <Helmet>
        <meta charSet="utf-8" />
        <title>Login</title>
        <link rel="canonical" href="http://mysite.com/example" />
      </Helmet>
      <form className="form" onSubmit={handleSubmit}>
        <p className="title">Log-In</p>

        {/* Display error messages */}
        {error && <div className="alert alert-danger">{error}</div>}

        {/* Display individual validation errors */}
        {errorList.map((err, index) => (
          <div key={index} className="alert alert-danger">
            {err.message}
          </div>
        ))}

        <div className="mb-2">
          <h6 className="pt-3 ">Email</h6>
          <input
            type="text"
            className="form-control pt-2"
            placeholder="Your Email"
            aria-label="Your Email"
            name="email"
            onChange={getData}
          ></input>
        </div>
        <div className="mb-2">
          <h6 className="pt-3 ">Password</h6>
          <input
            type="password"
            className="form-control pt-2"
            placeholder="Your Password"
            aria-label="Your Password"
            name="password"
            onChange={getData}
          ></input>
        </div>
        <button className="btn py-2 w-75 bg-black" type="submit">
          {isLoading ? <i className="fas fa-spinner fa-spin"></i> : "Login"}
        </button>
        <p>
          Don't have an account? <Link to="/signup">Sign-Up</Link>
        </p>
        <p>forget password</p>
      </form>
    </div>
  );
};

export default Login;
