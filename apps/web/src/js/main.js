// Example of sign-in function
async function signIn(event) {
  event.preventDefault(); // Prevents the default form submission

  // Capture form input values
  const email = document.getElementById("email").value;
  const password = document.getElementById("pass").value;

  // Create an object with the captured data
  const signInData = {
    email: email,
    password: password,
  };

  try {
    // Send the data to the backend API (adjust the URL to your backend)
    const response = await fetch("http://localhost:5000/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signInData),
    });

    // Handle the response
    if (response.ok) {
      const result = await response.json();
      // Do something with the result (e.g., redirect, show a message)
      alert("Sign-in successful!");
      window.location.href = "dashboard.html"; // Redirect user upon success
    } else {
      // Handle errors (e.g., incorrect credentials)
      alert("Sign-in failed. Please check your credentials.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred during sign-in.");
  }
}
