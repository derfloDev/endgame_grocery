import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AuthExpiredError, createTemporaryId } from "../../api/client";
import { writeCachedResource } from "../../api/offlineStore";
import { createList, deleteList, fetchLists, renameList } from "../../api/lists";
import InfoSheet from "../../components/InfoSheet/InfoSheet";
import ListCardHome from "../../components/ListCardHome/ListCardHome";
import NewListSheet from "../../components/NewListSheet/NewListSheet";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import ErrorState from "../../components/ui/ErrorState/ErrorState";
import FAB from "../../components/ui/FAB/FAB";
import Icon from "../../components/ui/Icon/Icon";
import LoadingState from "../../components/ui/LoadingState/LoadingState";
import logo from "../../assets/endgame_grocery_logo.png";
import { useAuth } from "../../context/AuthContext";
import { useListEvents } from "../../hooks/useListEvents";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import type { List } from "../../types";
import { leaveSharedList } from "../leaveListAction";
import styles from "./OverviewPage.module.css";
import {
  DEFAULT_OVERVIEW_SORT,
  isOverviewSortMode,
  sortLists
} from "./overviewSort";
import type { OverviewSortMode } from "./overviewSort";

const LISTS_CACHE_KEY = "lists";
const OVERVIEW_SORT_KEY = "overview_sort";

interface OverviewList extends List {
  name: string;
  owner_name?: string;
  is_pending_sync?: boolean;
}

export default function OverviewPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { syncVersion } = useOfflineQueue();
  const [lists, setLists] = useState<OverviewList[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [sortMode, setSortMode] = useState<OverviewSortMode>(() => {
    const storedSort = window.localStorage.getItem(OVERVIEW_SORT_KEY);
    return isOverviewSortMode(storedSort) ? storedSort : DEFAULT_OVERVIEW_SORT;
  });
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadLists = useCallback(async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await fetchLists(token);

      if (isMountedRef.current) {
        setLists((result.lists ?? []) as OverviewList[]);
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        setError(loadError);
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

  async function updateLists(updater: (currentLists: OverviewList[]) => OverviewList[]): Promise<void> {
    let nextLists: OverviewList[] = [];

    setLists((currentLists) => {
      nextLists = updater(currentLists);
      return nextLists;
    });

    await writeCachedResource(LISTS_CACHE_KEY, { lists: nextLists });
  }

  async function createListByName(name: string): Promise<void> {
    if (!name.trim()) {
      return;
    }

    try {
      setError(null);

      const temporaryList: OverviewList = {
        id: createTemporaryId("list"),
        name: name.trim(),
        owner_name: "You",
        is_owner: true,
        is_pending_sync: true
      };
      const result = await createList(token, { name }, { tempId: temporaryList.id });

      await updateLists((currentLists) => [
        ...currentLists,
        result?.queued ? temporaryList : (result.list as OverviewList)
      ]);
    } catch (submitError) {
      setError(submitError);
    }
  }

  async function submitRename(listId: string, newName: string): Promise<void> {
    if (!newName.trim()) {
      return;
    }

    try {
      setError(null);
      const result = await renameList(token, listId, { name: newName });

      await updateLists((currentLists) =>
        currentLists.map((list) =>
          list.id === listId
            ? {
                ...list,
                ...(result?.queued ? { name: newName.trim(), is_pending_sync: true } : (result.list as OverviewList))
              }
            : list
        )
      );
    } catch (submitError) {
      setError(submitError);
    }
  }

  async function handleDelete(listId: string): Promise<void> {
    if (!window.confirm(t("list.deleteConfirm"))) {
      return;
    }

    try {
      setError(null);
      await deleteList(token, listId);
      await updateLists((currentLists) => currentLists.filter((list) => list.id !== listId));
    } catch (submitError) {
      setError(submitError);
    }
  }

  async function handleLeave(listId: string): Promise<void> {
    await leaveSharedList({
      confirmMessage: t("list.leaveConfirm"),
      listId,
      token,
      onError: setError,
      onSuccess: () => updateLists((currentLists) => currentLists.filter((list) => list.id !== listId))
    });
  }

  function handleSortChange(nextSortMode: OverviewSortMode): void {
    setSortMode(nextSortMode);
    window.localStorage.setItem(OVERVIEW_SORT_KEY, nextSortMode);
  }

  const shouldSuppressError = error instanceof AuthExpiredError;
  const sortedLists = sortLists(lists, sortMode);

  return (
    <div>
      <div className={styles["overview-topbar"]}>
        <div className={styles["overview-brand"]}>
          <div>
            <div className={`eg-gradient-text eg-orbitron ${styles["overview-brand-title"]}`}>{t("app.brandMain")}</div>
            <div className={styles["overview-brand-sub"]}>{t("app.brandSub")}</div>
          </div>
          <div className={styles["overview-actions"]}>
            <div className={styles["overview-sort-control"]}>
              <label className="visually-hidden" htmlFor="overview-sort">
                {t("overview.sortLabel")}
              </label>
              <select
                id="overview-sort"
                className={styles["overview-sort-select"]}
                value={sortMode}
                onChange={(event) => handleSortChange(event.target.value as OverviewSortMode)}
              >
                <option value="created_asc">{t("overview.sortCreatedAsc")}</option>
                <option value="name_asc">{t("overview.sortNameAsc")}</option>
                <option value="activity_desc">{t("overview.sortActivityDesc")}</option>
              </select>
            </div>
            <img alt={t("app.brandName")} className={styles["overview-logo"]} src={logo} />
            <button aria-label={t("settings.open")} className="eg-icon-btn" type="button" onClick={() => setShowInfo(true)}>
              <Icon name="settings" color="var(--text-secondary)" size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className={styles["overview-content"]}>
        {error && !shouldSuppressError ? <ErrorState onRetry={() => void loadLists()} /> : null}
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
          ? sortedLists.map((list) => (
              <ListCardHome
                key={list.id}
                list={list}
                onDelete={() => void handleDelete(list.id)}
                onLeave={list.is_owner ? undefined : () => void handleLeave(list.id)}
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
