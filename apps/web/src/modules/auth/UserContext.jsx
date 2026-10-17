import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { clearAuthToken, readSession, setAuthToken } from "../../lib/auth-token.js";

const UserContext = createContext(null);

export const USER_ROLES = Object.freeze({ Admin: "Admin", User: "User" });

export function UserProvider({ children }) {
  // Read synchronously so protected routes never render before the session is known.
  const [userData, setUserData] = useState(readSession);

  const login = useCallback((token) => {
    setAuthToken(token);
    setUserData(readSession());
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUserData(null);
  }, []);

  const value = useMemo(() => ({ userData, login, logout }), [userData, login, logout]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
