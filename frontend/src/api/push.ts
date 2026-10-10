import { sendJsonRequest } from "./client";

interface VapidPublicKeyResponse {
  publicKey: string;
}

export function fetchVapidPublicKey(): Promise<VapidPublicKeyResponse> {
  return sendJsonRequest<VapidPublicKeyResponse>("/api/push/vapid-public-key", {
    method: "GET"
  });
}

export function subscribePush(token: string, subscription: PushSubscriptionJSON): Promise<unknown> {
  return sendJsonRequest("/api/push/subscribe", {
    method: "POST",
    token,
    payload: subscription
  });
}

export function unsubscribePush(token: string, endpoint: string): Promise<unknown> {
  return sendJsonRequest("/api/push/subscribe", {
    method: "DELETE",
    token,
    payload: { endpoint }
  });
}
