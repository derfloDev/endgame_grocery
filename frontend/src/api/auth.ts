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

/** Status of the user's API key. The key itself is never returned again after generation. */
interface ApiKeyStatus {
  has_key: boolean;
  hint: string | null;
  created_at: string | null;
}

/** Result of generating a key: the only response that contains the plaintext key. */
interface GeneratedApiKey {
  api_key: string;
  hint: string;
  created_at: string;
}

function sendAuthRequest<T>(path: string, payload: unknown): Promise<T> {
  return sendJsonRequest<T>(`/api/auth/${path}`, {
    method: "POST",
    payload
  });
}

/** Registration answers with a verification notice, or with a session when an invite was used. */
export function registerUser(payload: RegisterPayload): Promise<AuthResult | MessageResult> {
  return sendAuthRequest<AuthResult | MessageResult>("register", payload);
}

export function loginUser(payload: LoginCredentials): Promise<{ token: string; user?: User }> {
  return sendAuthRequest<{ token: string; user?: User }>("login", payload);
}

export function fetchCurrentUser(token: string): Promise<User> {
  return sendJsonRequest<User>("/api/auth/me", { token });
}

export function fetchApiKey(token: string): Promise<ApiKeyStatus> {
  return sendJsonRequest<ApiKeyStatus>("/api/auth/api-key", { token });
}

export function regenerateApiKey(token: string): Promise<GeneratedApiKey> {
  return sendJsonRequest<GeneratedApiKey>("/api/auth/api-key", { token, method: "POST" });
}

export function verifyEmail(token: string): Promise<AuthResult> {
  return sendJsonRequest<AuthResult>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: "GET"
  });
}

export function resendVerification(email: string): Promise<MessageResult> {
  return sendAuthRequest<MessageResult>("resend-verification", { email });
}

export function forgotPassword(email: string): Promise<MessageResult> {
  return sendAuthRequest<MessageResult>("forgot-password", { email });
}

export function resetPassword(token: string, password: string): Promise<MessageResult> {
  return sendAuthRequest<MessageResult>("reset-password", { token, password });
}
