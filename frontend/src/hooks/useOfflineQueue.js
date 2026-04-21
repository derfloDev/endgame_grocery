import { useContext } from "react";
import { OfflineQueueContext } from "../context/offlineQueueContextValue";

export function useOfflineQueue() {
  const context = useContext(OfflineQueueContext);

  if (!context) {
    throw new Error("useOfflineQueue must be used inside an OfflineQueueProvider.");
  }

  return context;
}
