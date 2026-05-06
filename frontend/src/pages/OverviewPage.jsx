import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { createTemporaryId } from "../api/client";
import { writeCachedResource } from "../api/offlineStore";
import { createList, deleteList, fetchLists, renameList } from "../api/lists";
import InfoSheet from "../components/InfoSheet";
import ListCardHome from "../components/ListCardHome";
import NewListSheet from "../components/NewListSheet";
import { EmptyState, ErrorState, FAB, Icon, LoadingState } from "../components/ui";
import logo from "../assets/endgame_grocery_logo.png";
import { useAuth } from "../context/AuthContext";
import { useListEvents } from "../hooks/useListEvents";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

const LISTS_CACHE_KEY = "lists";

export default function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { syncVersion } = useOfflineQueue();
  const [lists, setLists] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadLists = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const result = await fetchLists(token);

      if (isMountedRef.current) {
        setLists(result.lists ?? []);
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        setError(loadError.message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    void loadLists();
  }, [loadLists, syncVersion]);

  const handleListChange = useCallback(() => {
    void loadLists();
  }, [loadLists]);

  useListEvents("list:updated", null, handleListChange);
  useListEvents("list:deleted", null, handleListChange);

  async function updateLists(updater) {
    let nextLists = [];

    setLists((currentLists) => {
      nextLists = updater(currentLists);
      return nextLists;
    });

    await writeCachedResource(LISTS_CACHE_KEY, { lists: nextLists });
  }

  async function createListByName(name) {
    if (!name.trim()) {
      return;
    }

    try {
      setError("");

      const temporaryList = {
        id: createTemporaryId("list"),
        name: name.trim(),
        owner_name: "You",
        is_owner: true,
        is_pending_sync: true
      };
      const result = await createList(token, { name }, { tempId: temporaryList.id });

      await updateLists((currentLists) => [
        ...currentLists,
        result?.queued ? temporaryList : result.list
      ]);
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function submitRename(listId, newName) {
    if (!newName.trim()) {
      return;
    }

    try {
      setError("");
      const result = await renameList(token, listId, { name: newName });

      await updateLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? {
                ...list,
                ...(result?.queued ? { name: newName.trim(), is_pending_sync: true } : result.list)
              }
            : list
        )
      );
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function handleDelete(listId) {
    if (!window.confirm(t("list.deleteConfirm"))) {
      return;
    }

    try {
      setError("");
      await deleteList(token, listId);
      await updateLists((currentLists) => currentLists.filter((list) => list.id !== listId));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="overview-page">
      <div className="overview-topbar">
        <div className="overview-brand">
          <div>
            <div className="eg-gradient-text eg-orbitron overview-brand-title">{t("app.brandMain")}</div>
            <div className="overview-brand-sub">{t("app.brandSub")}</div>
          </div>
          <div className="overview-actions">
            <img alt={t("app.brandName")} className="overview-logo" src={logo} />
            <button aria-label={t("settings.open")} className="eg-icon-btn" type="button" onClick={() => setShowInfo(true)}>
              <Icon name="settings" color="var(--text-secondary)" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="overview-content">
        {error ? <ErrorState onRetry={() => void loadLists()} /> : null}
        {isLoading ? <LoadingState rows={3} /> : null}
        {!isLoading && !error && lists.length === 0 ? (
          <EmptyState
            action={t("list.newListAction")}
            body={t("list.noListsBody")}
            title={t("list.noListsTitle")}
            onAction={() => setShowNew(true)}
          />
        ) : null}
        {!isLoading && !error
          ? lists.map((list) => (
              <ListCardHome
                key={list.id}
                list={list}
                onDelete={() => void handleDelete(list.id)}
                onOpen={() => navigate(`/lists/${list.id}`)}
                onRename={(name) => void submitRename(list.id, name)}
              />
            ))
          : null}
      </div>

      <FAB onClick={() => setShowNew(true)} />
      <InfoSheet open={showInfo} onClose={() => setShowInfo(false)} />
      <NewListSheet
        open={showNew}
        onAdd={(name) => void createListByName(name)}
        onClose={() => setShowNew(false)}
      />
    </div>
  );
}
