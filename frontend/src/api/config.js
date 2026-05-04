import { sendJsonRequest } from "./client";

export function fetchAppConfig() {
  return sendJsonRequest("/api/config");
}
