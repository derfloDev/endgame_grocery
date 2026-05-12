import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

export default function OfflineBanner(): ReactElement | null {
  const { t } = useTranslation();
  const { isOffline, isSyncing, queuedCount, syncError } = useOfflineQueue();

  if (!isOffline && !isSyncing && !queuedCount && !syncError) {
    return null;
  }

  let message = t("offline.cached");

  if (queuedCount > 0 && isOffline) {
    message = t("offline.queued", { count: queuedCount });
  } else if (isSyncing) {
    message = t("offline.syncing", { count: queuedCount });
  } else if (queuedCount > 0) {
    message = t("offline.waiting", { count: queuedCount });
  }

  return (
    <p className={syncError ? "eg-error-banner" : "eg-offline-banner"}>
      {syncError ? `${message} ${syncError}` : message}
    </p>
  );
}
