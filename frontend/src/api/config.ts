import { sendJsonRequest } from "./client";
import type { AppConfig } from "../types";

export function fetchAppConfig(): Promise<AppConfig> {
  return sendJsonRequest("/api/config") as Promise<AppConfig>;
}
