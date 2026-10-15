import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { reconnect } from "../../api/reconnect";

export default function OfflineBanner(): ReactElement | null {
  const { t } = useTranslation();
  const { discardFailedMutation, failedMutationId, isOffline, isReauthRequired, isSyncing, queuedCount, syncError, syncErrorKey } = useOfflineQueue();

  // Access recovery takes precedence over offline/sync messages: the device is connected.
  if (isReauthRequired) {
    return (
      <>
        <p className="eg-offline-banner">{t(queuedCount > 0 ? "offline.reauthQueued" : "offline.reauth", { count: queuedCount })}</p>
        <button className="eg-btn-secondary" type="button" onClick={reconnect}>{t("offline.reconnect")}</button>
      </>
    );
  }

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
    <>
      <p className={syncError ? "eg-error-banner" : "eg-offline-banner"}>
        {syncError ? `${message} ${syncErrorKey ? t(syncErrorKey, { defaultValue: syncError }) : syncError}` : message}
      </p>
      {failedMutationId ? (
        <button className="eg-btn-secondary" type="button" onClick={() => void discardFailedMutation()}>
          {t("offline.discard")}
        </button>
      ) : null}
    </>
  );
}
