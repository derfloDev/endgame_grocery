import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { SESSION_EXPIRED_REDIRECT_KEY } from "../../context/authStorage";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps): ReactNode {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={readSessionExpiredRedirect() ?? { from: location.pathname }} />;
  }

  return children;
}

function readSessionExpiredRedirect(): { from: string; sessionExpired: true } | null {
  try {
    const storedState = JSON.parse(window.sessionStorage.getItem(SESSION_EXPIRED_REDIRECT_KEY) ?? "null") as unknown;

    if (!storedState || typeof storedState !== "object") {
      return null;
    }

    const redirectState = storedState as { from?: unknown; sessionExpired?: unknown };

    return typeof redirectState.from === "string" && redirectState.sessionExpired === true
      ? { from: redirectState.from, sessionExpired: true }
      : null;
  } catch {
    return null;
  }
}
