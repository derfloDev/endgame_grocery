import { createContext, useContext, useEffect, useState } from "react";
import { loginUser, registerUser } from "../api/auth";

const STORAGE_KEY = "endgame_grocery.auth_token";
const AuthContext = createContext(null);

function parseJwtSubject(token) {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4 || 4)) % 4),
      "="
    );
    const decodedPayload = JSON.parse(atob(paddedPayload));

    return decodedPayload.sub ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? "");
  const [user, setUser] = useState(() => {
    const storedToken = window.localStorage.getItem(STORAGE_KEY) ?? "";
    const sub = parseJwtSubject(storedToken);

    return sub ? { id: sub } : null;
  });

  useEffect(() => {
    if (!token) {
      window.localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      return;
    }

    const sub = parseJwtSubject(token);

    window.localStorage.setItem(STORAGE_KEY, token);
    setUser(sub ? { id: sub } : null);
  }, [token]);

  async function login(credentials) {
    const result = await loginUser(credentials);
    setToken(result.token);
    return result;
  }

  async function register(payload) {
    return registerUser(payload);
  }

  function logout() {
    setToken("");
  }

  const value = {
    token,
    user,
    login,
    register,
    setAuthToken: setToken,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}
