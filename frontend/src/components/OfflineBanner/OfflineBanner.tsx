import { useTranslation } from "react-i18next";
import type { ReactElement } from "react";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { reconnect } from "../../api/reconnect";

export default function OfflineBanner(): ReactElement | null {
  const { t } = useTranslation();
  const { discardFailedMutation, failedMutationId, isOffline, isReauthRequired, isSyncing, queuedCount, syncError, syncErrorKey } = useOfflineQueue();
  const errorText = syncErrorKey ? t(syncErrorKey, { defaultValue: syncError }) : syncError;

  // Access recovery replaces offline/sync messages, but a blocked change stays discardable:
  // discarding is local and does not require access to the server.
  if (isReauthRequired) {
    return (
      <>
        <p className="eg-offline-banner">{t(queuedCount > 0 ? "offline.reauthQueued" : "offline.reauth", { count: queuedCount })}</p>
        <button className="eg-btn-secondary" type="button" onClick={reconnect}>{t("offline.reconnect")}</button>
        {failedMutationId ? (
          <>
            <p className="eg-error-banner">{errorText}</p>
            <button className="eg-btn-secondary" type="button" onClick={() => void discardFailedMutation()}>
              {t("offline.discard")}
            </button>
          </>
        ) : null}
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
        {syncError ? `${message} ${errorText}` : message}
      </p>
      {failedMutationId ? (
        <button className="eg-btn-secondary" type="button" onClick={() => void discardFailedMutation()}>
          {t("offline.discard")}
        </button>
      ) : null}
    </>
  );
}
