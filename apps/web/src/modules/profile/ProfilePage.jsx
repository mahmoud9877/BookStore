import React from "react";
import { useUser } from "../auth/UserContext.jsx";
import "./ProfilePage.css";

// The session token carries only the user's name and role; other fields show when present.
export default function ProfilePage() {
  const { userData } = useUser();
  const joined = userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : "N/A";

  return (
    <div className="profile-container">
      <h1 className="profile-title">User Profile</h1>
      <div className="profile-card">
        <div className="profile-info">
          <i className="bi bi-person-circle profile-image d-inline-block fs-1" aria-hidden="true"></i>
          <h2 className="profile-name">{userData.userName}</h2>
          {userData.email && <p className="profile-email">{userData.email}</p>}
        </div>
        <div className="profile-details">
          <h3>Details</h3>
          <p>
            <strong>Role:</strong> {userData.role || "N/A"}
          </p>
          <p>
            <strong>Phone:</strong> {userData.phone || "N/A"}
          </p>
          <p>
            <strong>Address:</strong> {userData.address || "N/A"}
          </p>
          <p>
            <strong>Joined:</strong> {joined}
          </p>
        </div>
      </div>
    </div>
  );
}
