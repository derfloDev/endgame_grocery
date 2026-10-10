import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthExpiredError, createTemporaryId } from "../../api/client";
import { writeCachedResource } from "../../api/offlineStore";
import { SSE_EVENTS } from "../../api/sseEvents";
import { LISTS_CACHE_KEY, createList, deleteList, fetchLists, renameList } from "../../api/lists";
import ListCardHome from "../../components/ListCardHome/ListCardHome";
import NewListSheet from "../../components/NewListSheet/NewListSheet";
import DeferredSheet from "../../components/ui/DeferredSheet/DeferredSheet";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import ErrorState from "../../components/ui/ErrorState/ErrorState";
import FAB from "../../components/ui/FAB/FAB";
import Icon from "../../components/ui/Icon/Icon";
import LoadingState from "../../components/ui/LoadingState/LoadingState";
import logo from "../../assets/endgame_grocery_logo.png";
import { useAuth } from "../../context/AuthContext";
import { useEventSource } from "../../context/EventSourceContext";
import { useListEvents } from "../../hooks/useListEvents";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import type { List } from "../../types";
import { leaveSharedList } from "../leaveListAction";
import { InfoSheet } from "./lazySheets";
import styles from "./OverviewPage.module.css";
import {
  DEFAULT_OVERVIEW_SORT,
  isOverviewSortMode,
  sortLists
} from "./overviewSort";
import type { OverviewSortMode } from "./overviewSort";

const OVERVIEW_SORT_KEY = "overview_sort";

interface OverviewList extends List {
  name: string;
  owner_name?: string;
  is_pending_sync?: boolean;
}

function readNotice(state: unknown): string {
  const notice = (state as { notice?: unknown } | null)?.notice;

  return typeof notice === "string" ? notice : "";
}

export default function OverviewPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useAuth();
  const currentUserId = user?.id;
  const { syncVersion } = useOfflineQueue();
  const { resyncVersion } = useEventSource();
  // The detail page hands over why it sent the user back (list deleted, user removed).
  const [notice] = useState<string>(() => readNotice(location.state));
  const [lists, setLists] = useState<OverviewList[]>([]);
  // Event handlers read the current lists without re-subscribing on every change. The ref is
  // written together with the state (not from an effect), so a handler that runs right after a
  // render never sees stale lists.
  const listsRef = useRef<OverviewList[]>(lists);
  const applyLists = useCallback((nextLists: OverviewList[]) => {
    listsRef.current = nextLists;
    setLists(nextLists);
  }, []);
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
    // Show the notice once: drop it from the history entry so a reload does not repeat it.
    if (notice) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // Only the notice read on mount matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // True once lists are on screen (from the cache or the network). Only the very first load shows the
  // skeleton; later reloads (events, reconnects, sync) refresh in place.
  const hasListsRef = useRef<boolean>(false);
  const loadedForTokenRef = useRef<string>(token);

  const loadLists = useCallback(async (): Promise<void> => {
    if (loadedForTokenRef.current !== token) {
      // Another session: never keep showing the previous user's lists while loading.
      loadedForTokenRef.current = token;
      hasListsRef.current = false;
      applyLists([]);
      setIsLoading(true);
    }

    setError(null);

    if (!hasListsRef.current) {
      setIsLoading(true);
    }

    try {
      const result = await fetchLists(token, {
        // Cached lists are shown right away while the request is in flight.
        onCachedValue: (cached) => {
          if (!isMountedRef.current || loadedForTokenRef.current !== token) {
            return;
          }

          hasListsRef.current = true;
          applyLists((cached.lists ?? []) as OverviewList[]);
          setIsLoading(false);
        }
      });

      if (isMountedRef.current && loadedForTokenRef.current === token) {
        hasListsRef.current = true;
        applyLists((result.lists ?? []) as OverviewList[]);
      }
    } catch (loadError) {
      // A failed refresh keeps what is on screen; only an empty page reports the error.
      if (isMountedRef.current && !hasListsRef.current) {
        setError(loadError);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [applyLists, token]);

  useEffect(() => {
    void loadLists();
  }, [loadLists, syncVersion, resyncVersion]);

  const handleListChange = useCallback(() => {
    void loadLists();
  }, [loadLists]);

  // Drops a list that is gone for this user without waiting for (or showing) a reload.
  const removeListById = useCallback((listId: unknown) => {
    if (typeof listId !== "string") {
      return;
    }

    const remainingLists = listsRef.current.filter((list) => list.id !== listId);

    if (remainingLists.length === listsRef.current.length) {
      return;
    }

    applyLists(remainingLists);
    void writeCachedResource(LISTS_CACHE_KEY, { lists: remainingLists });
  }, [applyLists]);

  const handleListDeleted = useCallback(
    (data: Record<string, unknown>) => {
      removeListById(data.listId);
      void loadLists();
    },
    [loadLists, removeListById]
  );

  // The removed user is no longer a member, so the server sends this event to them directly.
  const handleMemberRemoved = useCallback(
    (data: Record<string, unknown>) => {
      if (currentUserId && data.userId === currentUserId) {
        removeListById(data.listId);
      }
    },
    [currentUserId, removeListById]
  );

  useListEvents(SSE_EVENTS.listUpdated, null, handleListChange);
  useListEvents(SSE_EVENTS.listDeleted, null, handleListDeleted);
  useListEvents(SSE_EVENTS.memberRemoved, null, handleMemberRemoved);

  async function updateLists(updater: (currentLists: OverviewList[]) => OverviewList[]): Promise<void> {
    const nextLists = updater(listsRef.current);

    applyLists(nextLists);

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
          <div className={styles["overview-brand-left"]}>
            <div className={`eg-gradient-text eg-orbitron ${styles["overview-brand-title"]}`}>{t("app.brandMain")}</div>
            <div className={styles["overview-brand-sub"]}>{t("app.brandSub")}</div>
          </div>
          <div className={styles["overview-actions"]}>
            <img alt={t("app.brandName")} className={styles["overview-logo"]} src={logo} />
            <button aria-label={t("settings.open")} className="eg-icon-btn" type="button" onClick={() => setShowInfo(true)}>
              <Icon name="settings" color="var(--text-secondary)" size={18} />
            </button>
          </div>
        </div>
        <div className={styles["overview-sort-row"]}>
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
      </div>

      <div className={styles["overview-content"]}>
        {notice ? <p className="eg-success-banner" role="status">{notice}</p> : null}
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
      <DeferredSheet open={showInfo}>
        <InfoSheet open={showInfo} onClose={() => setShowInfo(false)} />
      </DeferredSheet>
      <NewListSheet
        open={showNew}
        onAdd={(name) => void createListByName(name)}
        onClose={() => setShowNew(false)}
      />
    </div>
  );
}
