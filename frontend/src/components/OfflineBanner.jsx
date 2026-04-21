import { useOfflineQueue } from "../hooks/useOfflineQueue";

export default function OfflineBanner() {
  const { isOffline, isSyncing, queuedCount, syncError } = useOfflineQueue();

  if (!isOffline && !isSyncing && !queuedCount && !syncError) {
    return null;
  }

  let message = "Offline mode: cached data is available.";

  if (queuedCount > 0 && isOffline) {
    message = `Offline mode: ${queuedCount} change${queuedCount === 1 ? "" : "s"} waiting to sync.`;
  } else if (isSyncing) {
    message = `Syncing ${queuedCount} queued change${queuedCount === 1 ? "" : "s"}...`;
  } else if (queuedCount > 0) {
    message = `${queuedCount} queued change${queuedCount === 1 ? "" : "s"} still waiting to sync.`;
  }

  return (
    <p className={`offline-banner ${syncError ? "offline-banner-error" : ""}`}>
      {syncError ? `${message} ${syncError}` : message}
    </p>
  );
}
