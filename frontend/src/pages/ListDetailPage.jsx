import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createTemporaryId } from "../api/client";
import { createEntry, deleteEntry, fetchEntries, updateEntry } from "../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../api/history";
import { writeCachedResource } from "../api/offlineStore";
import { fetchLists, renameList } from "../api/lists";
import { fetchListMembers, revokeListMember, shareListWithMember } from "../api/sharing";
import AddItemSheet from "../components/AddItemSheet";
import EntryRow from "../components/EntryRow";
import ListOptionsSheet from "../components/ListOptionsSheet";
import RecentlyUsedSection from "../components/RecentlyUsedSection";
import RenameListSheet from "../components/RenameListSheet";
import ShareListSheet from "../components/ShareListSheet";
import { EmptyState, FAB, Icon, LoadingState, TopBar } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useListEvents } from "../hooks/useListEvents";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { filterRecentlyUsedItems, upsertRecentlyUsedItems } from "./recentlyUsedState";

const MOTION_DURATION_MS = 300;

export default function ListDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token } = useAuth();
  const { syncVersion } = useOfflineQueue();
  const [list, setList] = useState(null);
  const [entries, setEntries] = useState([]);
  const [members, setMembers] = useState([]);
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const [shareEmail, setShareEmail] = useState("");
  const [entryError, setEntryError] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isShareSubmitting, setIsShareSubmitting] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [exitingIds, setExitingIds] = useState(() => new Set());
  const [enteringIds, setEnteringIds] = useState(() => new Set());
  const [newlyAddedTexts, setNewlyAddedTexts] = useState(() => new Set());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialReducedMotionPreference);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const isMountedRef = useRef(false);
  const entriesRef = useRef([]);
  const exitingIdsRef = useRef(new Set());
  const activeTimeoutIdsRef = useRef(new Set());
  const entryAnimationTimeoutsRef = useRef(new Map());
  const recentlyUsedAnimationTimeoutsRef = useRef(new Map());
  const shouldShowPushToggle = Boolean(list) && (!list.is_owner || members.length > 1);
  const {
    isReady: isPushReady,
    isSubscribed,
    isSupported: isPushSupported,
    subscribe,
    unsubscribe
  } = usePushNotifications({
    enabled: shouldShowPushToggle,
    token
  });

  useEffect(() => {
    isMountedRef.current = true;
    const entryAnimationTimeouts = entryAnimationTimeoutsRef.current;
    const recentlyUsedAnimationTimeouts = recentlyUsedAnimationTimeoutsRef.current;
    const activeTimeoutIds = activeTimeoutIdsRef.current;

    return () => {
      isMountedRef.current = false;

      clearTrackedTimeoutMap(entryAnimationTimeouts, activeTimeoutIds);
      clearTrackedTimeoutMap(recentlyUsedAnimationTimeouts, activeTimeoutIds);

      for (const timeoutId of activeTimeoutIds) {
        window.clearTimeout(timeoutId);
      }

      activeTimeoutIds.clear();
    };
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    exitingIdsRef.current = exitingIds;
  }, [exitingIds]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);

      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener?.(handleChange);

    return () => {
      mediaQuery.removeListener?.(handleChange);
    };
  }, []);

  const markEnteringEntries = useCallback(
    (entryIds) => {
      if (prefersReducedMotion || !entryIds.length) {
        return;
      }

      setEnteringIds((currentIds) => {
        const nextIds = new Set(currentIds);

        for (const entryId of entryIds) {
          nextIds.add(entryId);
          scheduleTransientRemoval(
            entryAnimationTimeoutsRef.current,
            activeTimeoutIdsRef.current,
            entryId,
            () =>
              setEnteringIds((currentEnteringIds) => {
                const nextEnteringIds = new Set(currentEnteringIds);
                nextEnteringIds.delete(entryId);
                return nextEnteringIds;
              }),
            MOTION_DURATION_MS
          );
        }

        return nextIds;
      });
    },
    [prefersReducedMotion]
  );

  const markRecentlyUsedItems = useCallback(
    (texts) => {
      if (prefersReducedMotion || !texts.length) {
        return;
      }

      setNewlyAddedTexts((currentTexts) => {
        const nextTexts = new Set(currentTexts);

        for (const text of texts) {
          nextTexts.add(text);
          scheduleTransientRemoval(
            recentlyUsedAnimationTimeoutsRef.current,
            activeTimeoutIdsRef.current,
            text,
            () =>
              setNewlyAddedTexts((currentNewlyAddedTexts) => {
                const nextNewlyAddedTexts = new Set(currentNewlyAddedTexts);
                nextNewlyAddedTexts.delete(text);
                return nextNewlyAddedTexts;
              }),
            MOTION_DURATION_MS
          );
        }

        return nextTexts;
      });
    },
    [prefersReducedMotion]
  );

  const waitForAnimationDelay = useCallback(() => {
    if (prefersReducedMotion) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        activeTimeoutIdsRef.current.delete(timeoutId);
        resolve();
      }, MOTION_DURATION_MS);

      activeTimeoutIdsRef.current.add(timeoutId);
    });
  }, [prefersReducedMotion]);

  const loadEntries = useCallback(
    async ({ animateEntering = false, historyItems = null, throwOnError = false } = {}) => {
      try {
        const entriesResult = await fetchEntries(id, token);
        const nextEntries = entriesResult.entries ?? [];
        const previousEntries = entriesRef.current;

        if (isMountedRef.current) {
          entriesRef.current = nextEntries;
          setEntries(nextEntries);

          if (animateEntering) {
            markEnteringEntries(getEnteringEntryIds(previousEntries, nextEntries));
          }

          setRecentlyUsed((currentItems) => filterRecentlyUsedItems(historyItems ?? currentItems, nextEntries));
        }

        return nextEntries;
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(loadError.message);
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      }
    },
    [id, markEnteringEntries, token]
  );

  const loadMembers = useCallback(
    async ({ isOwner = false, throwOnError = false } = {}) => {
      if (!isOwner) {
        if (isMountedRef.current) {
          setMembers([]);
          setIsSharingLoading(false);
        }

        return [];
      }

      if (isMountedRef.current) {
        setIsSharingLoading(true);
      }

      try {
        const membersResult = await fetchListMembers(id, token);
        const nextMembers = membersResult.members ?? [];

        if (isMountedRef.current) {
          setMembers(nextMembers);
        }

        return nextMembers;
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(loadError.message);
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      } finally {
        if (isMountedRef.current) {
          setIsSharingLoading(false);
        }
      }
    },
    [id, token]
  );

  useEffect(() => {
    async function loadListDetail() {
      setEntryError("");
      setShareError("");
      setShareNotice("");
      setIsLoading(true);
      exitingIdsRef.current = new Set();
      setExitingIds(new Set());
      setEnteringIds(new Set());
      setNewlyAddedTexts(new Set());
      setRecentlyUsed([]);
      clearTrackedTimeoutMap(entryAnimationTimeoutsRef.current, activeTimeoutIdsRef.current);
      clearTrackedTimeoutMap(recentlyUsedAnimationTimeoutsRef.current, activeTimeoutIdsRef.current);

      try {
        const [listsResult, entriesResult, historyResult] = await Promise.all([
          fetchLists(token),
          fetchEntries(id, token),
          fetchRecentlyUsed(id, token).catch((error) => {
            console.error("Failed to load recently used history.", error);
            return { history: [] };
          })
        ]);
        const activeList = (listsResult.lists ?? []).find((candidate) => candidate.id === id);

        if (!isMountedRef.current) {
          return;
        }

        if (!activeList) {
          setEntryError("You no longer have access to this list.");
          setList(null);
          entriesRef.current = [];
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
          return;
        }

        setList(activeList);
        const nextEntries = entriesResult.entries ?? [];
        entriesRef.current = nextEntries;
        setEntries(nextEntries);
        setRecentlyUsed(filterRecentlyUsedItems(historyResult?.history ?? [], nextEntries));

        if (activeList.is_owner) {
          await loadMembers({
            isOwner: true,
            throwOnError: true
          });
        } else {
          setMembers([]);
          setShowOptions(false);
          setShowRename(false);
          setShowShare(false);
        }
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(loadError.message);
          setList(null);
          entriesRef.current = [];
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsSharingLoading(false);
        }
      }
    }

    void loadListDetail();
  }, [id, loadEntries, loadMembers, syncVersion, token]);

  const handleEntryChange = useCallback(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleCreatedEntry = useCallback(() => {
    void loadEntries({ animateEntering: true });
  }, [loadEntries]);

  const handleDeletedEntry = useCallback(
    ({ entryId } = {}) => {
      if (!entryId || prefersReducedMotion || !entriesRef.current.some((entry) => entry.id === entryId && entry.status === "open")) {
        void loadEntries();
        return;
      }

      if (exitingIdsRef.current.has(entryId)) {
        return;
      }

      const nextExitingIds = new Set(exitingIdsRef.current);
      nextExitingIds.add(entryId);
      exitingIdsRef.current = nextExitingIds;
      setExitingIds(nextExitingIds);

      void (async () => {
        try {
          await waitForAnimationDelay();
          await loadEntries();
        } finally {
          if (isMountedRef.current) {
            const nextExitingIdsAfterLoad = new Set(exitingIdsRef.current);
            nextExitingIdsAfterLoad.delete(entryId);
            exitingIdsRef.current = nextExitingIdsAfterLoad;
            setExitingIds(nextExitingIdsAfterLoad);
          }
        }
      })();
    },
    [loadEntries, prefersReducedMotion, waitForAnimationDelay]
  );

  const handleMemberChange = useCallback(() => {
    void loadMembers({ isOwner: list?.is_owner ?? false });
  }, [list?.is_owner, loadMembers]);

  useListEvents("entry:created", id, handleCreatedEntry);
  useListEvents("entry:updated", id, handleEntryChange);
  useListEvents("entry:deleted", id, handleDeletedEntry);
  useListEvents("member:added", id, handleMemberChange);
  useListEvents("member:removed", id, handleMemberChange);

  async function updateEntries(updater, { animateEntering = false } = {}) {
    const previousEntries = entriesRef.current;
    const nextEntries = updater(previousEntries);
    entriesRef.current = nextEntries;
    setEntries(nextEntries);

    if (animateEntering) {
      markEnteringEntries(getEnteringEntryIds(previousEntries, nextEntries));
    }

    await writeCachedResource(`entries:${id}`, { entries: nextEntries });
  }

  async function updateMembers(updater) {
    let nextMembers = [];

    setMembers((currentMembers) => {
      nextMembers = updater(currentMembers);
      return nextMembers;
    });

    await writeCachedResource(`members:${id}`, { members: nextMembers });
  }

  async function scheduleEntryExit(entryId, action, onComplete) {
    if (prefersReducedMotion) {
      const result = await action();
      await onComplete(result);
      return;
    }

    if (exitingIdsRef.current.has(entryId)) {
      return;
    }

    const nextExitingIds = new Set(exitingIdsRef.current);
    nextExitingIds.add(entryId);
    exitingIdsRef.current = nextExitingIds;
    setExitingIds(nextExitingIds);

    const waitPromise = waitForAnimationDelay();

    try {
      const result = await action();
      await waitPromise;
      await onComplete(result);
    } finally {
      if (isMountedRef.current) {
        const nextExitingIdsAfterComplete = new Set(exitingIdsRef.current);
        nextExitingIdsAfterComplete.delete(entryId);
        exitingIdsRef.current = nextExitingIdsAfterComplete;
        setExitingIds(nextExitingIdsAfterComplete);
      }
    }
  }

  function addToRecentlyUsed(entry) {
    const nextText = entry?.text?.trim();

    if (!nextText) {
      return;
    }

    markRecentlyUsedItems([nextText]);
    setRecentlyUsed((currentItems) => upsertRecentlyUsedItems(currentItems, entry));
  }

  async function addEntryByText(text, icon, details = "") {
    const trimmed = text.trim();

    if (!trimmed) {
      return false;
    }

    try {
      setEntryError("");
      const nextDetails = normalizeEntryDetails(details);

      const temporaryEntry = {
        id: createTemporaryId("entry"),
        text: trimmed,
        icon: icon ?? null,
        details: nextDetails,
        status: "open",
        created_at: new Date().toISOString(),
        is_pending_sync: true
      };
      const result = await createEntry(
        id,
        token,
        { text: trimmed, icon: icon ?? null, details },
        { tempId: temporaryEntry.id }
      );

      await updateEntries(
        (currentEntries) => sortEntries([...currentEntries, result?.queued ? temporaryEntry : result.entry]),
        { animateEntering: true }
      );
      return true;
    } catch (submitError) {
      setEntryError(submitError.message);
      return false;
    }
  }

  async function toggleStatus(entry) {
    try {
      setEntryError("");
      const nextStatus = entry.status === "open" ? "done" : "open";
      await scheduleEntryExit(
        entry.id,
        () => updateEntry(id, entry.id, token, { status: nextStatus }),
        async (result) => {
          await updateEntries((currentEntries) =>
            sortEntries(
              currentEntries.map((currentEntry) =>
                currentEntry.id === entry.id
                  ? {
                      ...currentEntry,
                      ...(result?.queued ? { is_pending_sync: true, status: nextStatus } : result.entry)
                    }
                  : currentEntry
              )
            )
          );

          if (nextStatus === "done") {
            addToRecentlyUsed(result?.queued ? entry : result?.entry ?? entry);
          }
        }
      );
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function submitEditEntry(entryId, text, iconName, details = "") {
    const trimmed = text.trim();

    if (!trimmed) {
      return false;
    }

    try {
      setEntryError("");
      const nextIcon = iconName ?? null;
      const nextDetails = normalizeEntryDetails(details);
      const result = await updateEntry(id, entryId, token, { text: trimmed, icon: nextIcon, details });

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === entryId
              ? {
                  ...currentEntry,
                  ...(result?.queued
                    ? { details: nextDetails, icon: nextIcon, is_pending_sync: true, text: trimmed }
                    : result.entry)
                }
              : currentEntry
          )
        )
      );
      return true;
    } catch (submitError) {
      setEntryError(submitError.message);
      return false;
    }
  }

  async function handleDeleteEntry(entryId) {
    try {
      setEntryError("");
      const entryToArchive = entriesRef.current.find((entry) => entry.id === entryId);
      await scheduleEntryExit(
        entryId,
        () => deleteEntry(id, entryId, token),
        async () => {
          await updateEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));

          if (entryToArchive) {
            addToRecentlyUsed(entryToArchive);
          }
        }
      );
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function handleAddFromHistory(text, icon) {
    const historyItem = recentlyUsed.find((item) => item.text === text);
    setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== text));

    const didAdd = await addEntryByText(text, icon);

    if (!didAdd && historyItem) {
      setRecentlyUsed((currentItems) => {
        if (currentItems.some((item) => item.text === historyItem.text)) {
          return currentItems;
        }

        return [historyItem, ...currentItems];
      });
    }
  }

  function handleDismissFromHistory(text) {
    setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== text));

    void deleteFromHistory(id, text, token).catch((error) => {
      console.error("Failed to delete recently used history item.", error);
    });
  }

  async function handleRename(newName) {
    try {
      setEntryError("");
      const result = await renameList(token, id, { name: newName });
      setList((currentList) =>
        currentList
          ? {
              ...currentList,
              name: result?.queued ? newName : result.list?.name ?? newName,
              is_pending_sync: result?.queued ? true : currentList.is_pending_sync
            }
          : currentList
      );
    } catch (submitError) {
      setEntryError(submitError.message);
      throw submitError;
    }
  }

  async function handleShareSubmit(event) {
    event.preventDefault();

    if (!shareEmail.trim()) {
      return;
    }

    try {
      setIsShareSubmitting(true);
      setShareError("");
      setShareNotice("");
      const result = await shareListWithMember(id, token, { email: shareEmail });

      if (result?.queued) {
        setShareNotice(`Invitation queued for ${shareEmail.trim()}.`);
      } else if (result?.invite?.invited_email) {
        setShareNotice(`Invitation sent to ${result.invite.invited_email}.`);
      }

      setShareEmail("");
    } catch (submitError) {
      setShareError(submitError.message);
    } finally {
      setIsShareSubmitting(false);
    }
  }

  async function handleRevokeMember(memberId) {
    try {
      setShareError("");
      await revokeListMember(id, memberId, token);
      await updateMembers((currentMembers) => currentMembers.filter((member) => member.user_id !== memberId));
    } catch (submitError) {
      setShareError(submitError.message);
    }
  }

  async function handlePushToggle() {
    try {
      setEntryError("");

      if (isSubscribed) {
        await unsubscribe();
        return;
      }

      await subscribe();
    } catch (pushError) {
      setEntryError(pushError.message);
    }
  }

  const openEntries = entries.filter((entry) => entry.status === "open");
  const visibleRecentlyUsed = filterRecentlyUsedItems(recentlyUsed, openEntries);
  const visibleMemberBadges = list?.is_owner ? members.filter((member) => !member.is_owner) : [];

  return (
    <div className="detail-page">
      <TopBar
        actions={
          list?.is_owner
            ? [
                {
                  ariaLabel: "List options",
                  icon: <Icon color="var(--text-secondary)" name="moreVertical" size={20} />,
                  onClick: () => setShowOptions(true)
                }
              ]
            : []
        }
        title={list?.name ?? "List"}
        onBack={() => navigate("/")}
      />

      <div className="detail-content">
        {list ? (
          <div className="detail-meta">
            <div className="list-card-chips">
              <span className={list.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
                {list.is_owner ? "Owner" : `Shared · ${list.owner_name ?? "another member"}`}
              </span>
              {list.is_pending_sync ? <span className="eg-chip-queued">Queued</span> : null}
            </div>
            {visibleMemberBadges.length > 0 ? (
              <div className="detail-member-badges">
                {visibleMemberBadges.map((member) => (
                  <span
                    key={member.user_id}
                    className="eg-chip-member-initial"
                    title={member.display_name}
                  >
                    {getInitials(member.display_name)}
                  </span>
                ))}
              </div>
            ) : null}
            {shouldShowPushToggle && isPushSupported ? (
              <button
                className="eg-btn-secondary"
                disabled={!isPushReady}
                type="button"
                onClick={() => void handlePushToggle()}
              >
                {isSubscribed ? "Disable notifications" : "Enable notifications"}
              </button>
            ) : null}
          </div>
        ) : null}

        {entryError ? <div className="detail-banner eg-error-banner">{entryError}</div> : null}
        {isLoading ? <LoadingState rows={4} /> : null}

        {!isLoading ? (
          <>
            <section className="entry-section">
              <div className="entry-section-header">
                <span className="detail-section-label">OPEN ITEMS</span>
                <span className="eg-chip-purple">{openEntries.length}</span>
              </div>

              {openEntries.length === 0 ? (
                <EmptyState body="No open items. Add one with the + button." title="All clear" />
              ) : (
                openEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    isEntering={enteringIds.has(entry.id)}
                    isExiting={exitingIds.has(entry.id)}
                    onDelete={() => void handleDeleteEntry(entry.id)}
                    onEdit={() => setEditingEntry(entry)}
                    onToggle={() => void toggleStatus(entry)}
                  />
                ))
              )}
            </section>

            <RecentlyUsedSection
              items={visibleRecentlyUsed}
              newlyAddedTexts={newlyAddedTexts}
              onAdd={(text, icon) => void handleAddFromHistory(text, icon)}
              onDismiss={handleDismissFromHistory}
            />
          </>
        ) : null}
      </div>

      {list ? <FAB onClick={() => setShowAddItem(true)} /> : null}
      <AddItemSheet
        listId={id}
        open={showAddItem}
        onAdd={(text, icon, details) => addEntryByText(text, icon, details)}
        onClose={() => setShowAddItem(false)}
      />
      <AddItemSheet
        initialDetails={editingEntry?.details ?? ""}
        initialIconName={editingEntry?.icon ?? null}
        initialText={editingEntry?.text ?? ""}
        listId={id}
        mode="edit"
        open={Boolean(editingEntry)}
        onAdd={async (text, icon, details) => {
          if (!editingEntry) {
            return false;
          }

          const didSaveEntry = await submitEditEntry(editingEntry.id, text, icon, details);

          if (didSaveEntry) {
            setEditingEntry(null);
          }

          return didSaveEntry;
        }}
        onClose={() => setEditingEntry(null)}
      />
      <ListOptionsSheet
        isOwner={list?.is_owner ?? false}
        open={showOptions}
        onClose={() => setShowOptions(false)}
        onRenameSelect={() => setShowRename(true)}
        onShareSelect={() => setShowShare(true)}
      />
      <RenameListSheet
        currentName={list?.name ?? ""}
        open={showRename}
        onClose={() => setShowRename(false)}
        onRename={handleRename}
      />
      <ShareListSheet
        isSharingLoading={isSharingLoading}
        isSubmitting={isShareSubmitting}
        members={members}
        open={showShare}
        shareEmail={shareEmail}
        shareError={shareError}
        shareNotice={shareNotice}
        onClose={() => setShowShare(false)}
        onEmailChange={setShareEmail}
        onRevoke={handleRevokeMember}
        onShareSubmit={handleShareSubmit}
      />
    </div>
  );
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    if (left.status === right.status) {
      return new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime();
    }

    return left.status === "open" ? -1 : 1;
  });
}

function normalizeEntryDetails(details) {
  if (typeof details !== "string") {
    return null;
  }

  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

function getInitialReducedMotionPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getEnteringEntryIds(previousEntries, nextEntries) {
  const previousOpenEntryIds = new Set(
    previousEntries.filter((entry) => entry.status === "open").map((entry) => entry.id)
  );

  return nextEntries
    .filter((entry) => entry.status === "open" && !previousOpenEntryIds.has(entry.id))
    .map((entry) => entry.id);
}

function scheduleTransientRemoval(timeoutMap, activeTimeoutIds, key, onRemove, duration) {
  const existingTimeoutId = timeoutMap.get(key);

  if (existingTimeoutId) {
    window.clearTimeout(existingTimeoutId);
    activeTimeoutIds.delete(existingTimeoutId);
  }

  const timeoutId = window.setTimeout(() => {
    timeoutMap.delete(key);
    activeTimeoutIds.delete(timeoutId);
    onRemove();
  }, duration);

  timeoutMap.set(key, timeoutId);
  activeTimeoutIds.add(timeoutId);
}

function clearTrackedTimeoutMap(timeoutMap, activeTimeoutIds) {
  for (const timeoutId of timeoutMap.values()) {
    window.clearTimeout(timeoutId);
    activeTimeoutIds.delete(timeoutId);
  }

  timeoutMap.clear();
}

function getInitials(name) {
  if (typeof name !== "string") {
    return "?";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "?";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
