import { sendJsonRequest } from "./client";
import type { User } from "../types";

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterPayload extends LoginCredentials {
  display_name?: string;
  invite_token?: string;
}

interface AuthResult {
  token: string;
  user?: User;
  listId?: string;
}

interface MessageResult {
  message?: string;
}

interface ApiKeyResult {
  api_key: string | null;
}

function sendAuthRequest(path: string, payload: unknown): Promise<unknown> {
  return sendJsonRequest(`/api/auth/${path}`, {
    method: "POST",
    payload
  });
}

export function registerUser(payload: RegisterPayload): Promise<AuthResult | MessageResult | unknown> {
  return sendAuthRequest("register", payload);
}

export function loginUser(payload: LoginCredentials): Promise<{ token: string; user?: User }> {
  return sendAuthRequest("login", payload) as Promise<{ token: string; user?: User }>;
}

export function fetchCurrentUser(token: string): Promise<User> {
  return sendJsonRequest("/api/auth/me", { token }) as Promise<User>;
}

export function fetchApiKey(token: string): Promise<ApiKeyResult> {
  return sendJsonRequest("/api/auth/api-key", { token }) as Promise<ApiKeyResult>;
}

export function regenerateApiKey(token: string): Promise<{ api_key: string }> {
  return sendJsonRequest("/api/auth/api-key", { token, method: "POST" }) as Promise<{ api_key: string }>;
}

export function verifyEmail(token: string): Promise<AuthResult> {
  return sendJsonRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: "GET"
  }) as Promise<AuthResult>;
}

export function resendVerification(email: string): Promise<MessageResult | unknown> {
  return sendAuthRequest("resend-verification", { email });
}

export function forgotPassword(email: string): Promise<MessageResult | unknown> {
  return sendAuthRequest("forgot-password", { email });
}

export function resetPassword(token: string, password: string): Promise<MessageResult | unknown> {
  return sendAuthRequest("reset-password", { token, password });
}
