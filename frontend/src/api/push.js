import { sendJsonRequest } from "./client";

export function fetchVapidPublicKey() {
  return sendJsonRequest("/api/push/vapid-public-key", {
    method: "GET"
  });
}

export function subscribePush(token, subscription) {
  return sendJsonRequest("/api/push/subscribe", {
    method: "POST",
    token,
    payload: subscription
  });
}

export function unsubscribePush(token, endpoint) {
  return sendJsonRequest("/api/push/subscribe", {
    method: "DELETE",
    token,
    payload: { endpoint }
  });
}
