import { useContext } from "react";
import { OfflineQueueContext } from "../context/offlineQueueContextValue";
import type { OfflineQueueContextValue } from "../types";

export function useOfflineQueue(): OfflineQueueContextValue {
  const context = useContext(OfflineQueueContext);

  if (!context) {
    throw new Error("useOfflineQueue must be used inside an OfflineQueueProvider.");
  }

  return context;
}
