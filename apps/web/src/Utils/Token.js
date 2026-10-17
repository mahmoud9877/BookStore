import axios from "axios";
async function getProtectedData() {
  const token = localStorage.getItem("userToken"); // Get the token from localStorage

  // Add the token to the request headers using the Bearer schema
  const config = {
    headers: { Authorization: `Bearer ${token}` },
  };

  try {
    const response = await axios.get(
      `https://ecommerce-fawn-iota.vercel.app/protected-route`,
      config
    );
  } catch (err) {
    console.error("Error fetching protected data", err);
  }
}

export default getProtectedData();
