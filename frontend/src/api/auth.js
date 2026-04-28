import { sendJsonRequest } from "./client";

function sendAuthRequest(path, payload) {
  return sendJsonRequest(`/api/auth/${path}`, {
    method: "POST",
    payload
  });
}

export function registerUser(payload) {
  return sendAuthRequest("register", payload);
}

export function loginUser(payload) {
  return sendAuthRequest("login", payload);
}

export function verifyEmail(token) {
  return sendJsonRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    method: "GET"
  });
}

export function resendVerification(email) {
  return sendAuthRequest("resend-verification", { email });
}

export function forgotPassword(email) {
  return sendAuthRequest("forgot-password", { email });
}

export function resetPassword(token, password) {
  return sendAuthRequest("reset-password", { token, password });
}
