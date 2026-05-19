import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchCurrentUser, loginUser, registerUser } from "../api/auth";
import type { User } from "../types";
import { SESSION_EXPIRED_REDIRECT_KEY } from "./authStorage";

const STORAGE_KEY = "endgame_grocery.auth_token";
const USER_STORAGE_KEY = "endgame_grocery.auth_user";
interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResult {
  token: string;
  user?: User;
}

interface AuthContextValue {
  token: string;
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  register: (payload: unknown) => Promise<unknown>;
  logout: () => void;
  setAuthToken: (token: string, user?: User | null) => void;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwtSubject(token: string): string | null {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4 || 4)) % 4),
      "="
    );
    const decodedPayload = JSON.parse(atob(paddedPayload)) as unknown;

    return isRecord(decodedPayload) && typeof decodedPayload.sub === "string" ? decodedPayload.sub : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps): ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => window.localStorage.getItem(STORAGE_KEY) ?? "");
  const [user, setUser] = useState(() => getStoredUser(window.localStorage.getItem(STORAGE_KEY) ?? ""));

  const setAuthToken = useCallback((nextToken: string, nextUser: User | null = null): void => {
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

  const logout = useCallback((): void => {
    setAuthToken("");
  }, [setAuthToken]);

  useEffect(() => {
    function handleAuthExpired(): void {
      const redirectState = {
        from: location.pathname,
        sessionExpired: true
      };

      window.sessionStorage.setItem(SESSION_EXPIRED_REDIRECT_KEY, JSON.stringify(redirectState));
      navigate("/login", {
        replace: true,
        state: redirectState
      });
      logout();
    }

    window.addEventListener("auth:expired", handleAuthExpired);

    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, [location.pathname, logout, navigate]);

  useEffect(() => {
    if (!token || user?.display_name) {
      return;
    }

    let cancelled = false;

    // Restore profile details for older or partially cleared sessions that still have a valid JWT.
    fetchCurrentUser(token)
      .then((profile) => {
        if (!cancelled) {
          setAuthToken(token, profile);
        }
      })
      .catch(() => {
        // Keep the session active even if profile rehydration is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.display_name, setAuthToken]);

  async function login(credentials: LoginCredentials): Promise<LoginResult> {
    const result = await loginUser(credentials);
    setAuthToken(result.token, result.user ?? null);
    return result;
  }

  async function register(payload: unknown): Promise<unknown> {
    return registerUser(payload as Parameters<typeof registerUser>[0]);
  }

  const value: AuthContextValue = {
    token,
    user,
    login,
    register,
    setAuthToken,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}

function getStoredUser(token: string): User | null {
  const sub = parseJwtSubject(token);

  if (!sub) {
    return null;
  }

  try {
    const storedUser = JSON.parse(window.localStorage.getItem(USER_STORAGE_KEY) ?? "null") as unknown;
    return normalizeAuthUser(token, storedUser);
  } catch {
    return { id: sub };
  }
}

function normalizeAuthUser(token: string, user: unknown): User | null {
  const sub = parseJwtSubject(token);

  if (!sub) {
    return null;
  }

  if (!isRecord(user)) {
    return { id: sub };
  }

  if (typeof user.id === "string" && user.id !== sub) {
    return { id: sub };
  }

  return {
    id: sub,
    ...(typeof user.display_name === "string" && user.display_name ? { display_name: user.display_name } : {}),
    ...(typeof user.email === "string" && user.email ? { email: user.email } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
