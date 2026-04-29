import { createContext, useCallback, useContext, useState } from "react";
import { loginUser, registerUser } from "../api/auth";

const STORAGE_KEY = "endgame_grocery.auth_token";
const USER_STORAGE_KEY = "endgame_grocery.auth_user";
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
  const [user, setUser] = useState(() => getStoredUser(window.localStorage.getItem(STORAGE_KEY) ?? ""));

  const setAuthToken = useCallback((nextToken, nextUser = null) => {
    setToken(nextToken);

    if (!nextToken) {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
      return;
    }

    const normalizedUser = normalizeAuthUser(nextToken, nextUser) ?? getStoredUser(nextToken);

    window.localStorage.setItem(STORAGE_KEY, nextToken);
    if (normalizedUser?.display_name || normalizedUser?.email) {
      window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
    } else {
      window.localStorage.removeItem(USER_STORAGE_KEY);
    }

    setUser(normalizedUser);
  }, []);

  async function login(credentials) {
    const result = await loginUser(credentials);
    setAuthToken(result.token, result.user ?? null);
    return result;
  }

  async function register(payload) {
    return registerUser(payload);
  }

  function logout() {
    setAuthToken("");
  }

  const value = {
    token,
    user,
    login,
    register,
    setAuthToken,
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

function getStoredUser(token) {
  const sub = parseJwtSubject(token);

  if (!sub) {
    return null;
  }

  try {
    const storedUser = JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY) ?? "null");
    return normalizeAuthUser(token, storedUser);
  } catch {
    return { id: sub };
  }
}

function normalizeAuthUser(token, user) {
  const sub = parseJwtSubject(token);

  if (!sub) {
    return null;
  }

  if (!user || typeof user !== "object") {
    return { id: sub };
  }

  if (user.id && user.id !== sub) {
    return { id: sub };
  }

  return {
    id: sub,
    ...(typeof user.display_name === "string" && user.display_name ? { display_name: user.display_name } : {}),
    ...(typeof user.email === "string" && user.email ? { email: user.email } : {})
  };
}
