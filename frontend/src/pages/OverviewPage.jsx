import { useCallback, useEffect, useState } from "react";
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
import { useOfflineQueue } from "../hooks/useOfflineQueue";

const LISTS_CACHE_KEY = "lists";

export default function OverviewPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { syncVersion } = useOfflineQueue();
  const [lists, setLists] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState("active");
  const [showInfo, setShowInfo] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const loadLists = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const result = await fetchLists(token);
      setLists(result.lists ?? []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    async function loadListsForEffect() {
      setError("");
      setIsLoading(true);

      try {
        const result = await fetchLists(token);

        if (isMounted) {
          setLists(result.lists ?? []);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadListsForEffect();

    return () => {
      isMounted = false;
    };
  }, [syncVersion, token]);

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
    if (!window.confirm("Delete this list?")) {
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

  const sharedCount = lists.filter((list) => !list.is_owner).length;
  const displayLists = lists;

  return (
    <div className="overview-page">
      <div className="overview-topbar">
        <div className="overview-brand">
          <div>
            <div className="eg-gradient-text eg-orbitron overview-brand-title">ENDGAME</div>
            <div className="overview-brand-sub">GROCERY</div>
          </div>
          <div className="overview-actions">
            <img alt="Endgame Grocery" className="overview-logo" src={logo} />
            <button aria-label="Settings" className="eg-icon-btn" type="button" onClick={() => setShowInfo(true)}>
              <Icon name="settings" color="var(--text-secondary)" size={18} />
            </button>
          </div>
        </div>
        <div className="overview-chips">
          <span className="eg-chip-purple">
            <Icon color="var(--neon-violet)" name="list" size={12} />
            <span>{lists.length} {lists.length === 1 ? "list" : "lists"}</span>
          </span>
          {sharedCount > 0 ? <span className="eg-chip-cyan">{sharedCount} shared</span> : null}
        </div>
      </div>

      <div className="overview-toggle">
        {["active", "all"].map((toggle) => (
          <button
            key={toggle}
            className={view === toggle ? "eg-toggle eg-toggle-active" : "eg-toggle"}
            type="button"
            onClick={() => setView(toggle)}
          >
            {toggle === "active" ? "Active" : "All Lists"}
          </button>
        ))}
      </div>

      <div className="overview-content">
        {error ? <ErrorState onRetry={() => void loadLists()} /> : null}
        {isLoading ? <LoadingState rows={3} /> : null}
        {!isLoading && !error && displayLists.length === 0 ? (
          <EmptyState
            action="New List"
            body="Create your first mission to get started."
            title="No lists yet"
            onAction={() => setShowNew(true)}
          />
        ) : null}
        {!isLoading && !error
          ? displayLists.map((list) => (
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
