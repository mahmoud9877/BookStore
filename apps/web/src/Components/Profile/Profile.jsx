import React from "react";
import "./Profile.css"; // Importing the external CSS file

export default function Profile(props) {
  const { userData } = props; // Destructure userData from props

  return (
    <div className="profile-container">
      <h1 className="profile-title">User Profile</h1>
      <div className="profile-card">
        <div className="profile-info">
          <img
            src={"https://via.placeholder.com/150"}
            alt="Profile"
            className="profile-image"
          />
          <h2 className="profile-name">{userData.userName}</h2>
          <p className="profile-email">{userData.email}</p>
        </div>
        <div className="profile-details">
          <h3>Details</h3>
          <p>
            <strong>Phone:</strong> {userData.phone || "N/A"}
          </p>
          <p>
            <strong>Address:</strong> {userData.address || "N/A"}
          </p>
          <p>
            <strong>Joined:</strong>{" "}
            {new Date(userData.createdAt).toLocaleDateString() || "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
