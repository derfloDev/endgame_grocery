import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { createTemporaryId } from "../api/client";
import { createEntry, fetchEntries, updateEntry } from "../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../api/history";
import { writeCachedResource } from "../api/offlineStore";
import { fetchLists, renameList } from "../api/lists";
import { fetchListMembers, revokeListMember, shareListWithMember } from "../api/sharing";
import AddItemSheet from "../components/AddItemSheet";
import EntryTile from "../components/EntryTile";
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

export default function ListDetailPage() {
  const { t } = useTranslation();
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
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const isMountedRef = useRef(false);
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

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadEntries = useCallback(
    async ({ historyItems = null, throwOnError = false } = {}) => {
      try {
        const entriesResult = await fetchEntries(id, token);
        const nextEntries = entriesResult.entries ?? [];

        if (isMountedRef.current) {
          setEntries(nextEntries);
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
    [id, token]
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
      setRecentlyUsed([]);

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
          setEntryError(t("detail.accessError"));
          setList(null);
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
          return;
        }

        setList(activeList);
        const nextEntries = entriesResult.entries ?? [];
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
  }, [id, loadEntries, loadMembers, syncVersion, t, token]);

  const handleEntryChange = useCallback(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleMemberChange = useCallback(() => {
    void loadMembers({ isOwner: list?.is_owner ?? false });
  }, [list?.is_owner, loadMembers]);

  useListEvents("entry:created", id, handleEntryChange);
  useListEvents("entry:updated", id, handleEntryChange);
  useListEvents("entry:deleted", id, handleEntryChange);
  useListEvents("member:added", id, handleMemberChange);
  useListEvents("member:removed", id, handleMemberChange);

  async function updateEntries(updater) {
    let nextEntries = [];

    setEntries((currentEntries) => {
      nextEntries = updater(currentEntries);
      return nextEntries;
    });

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

  async function addEntryByText(text, icon, details = "") {
    const trimmed = text.trim();

    if (!trimmed) {
      return false;
    }

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

    await updateEntries((currentEntries) => sortEntries([...currentEntries, temporaryEntry]));

    try {
      setEntryError("");
      const result = await createEntry(
        id,
        token,
        { text: trimmed, icon: icon ?? null, details },
        { tempId: temporaryEntry.id }
      );

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === temporaryEntry.id ? (result?.queued ? temporaryEntry : result.entry) : currentEntry
          )
        )
      );
      return true;
    } catch (submitError) {
      await updateEntries((currentEntries) =>
        currentEntries.filter((currentEntry) => currentEntry.id !== temporaryEntry.id)
      );
      setEntryError(submitError.message);
      return false;
    }
  }

  async function toggleStatus(entry) {
    const nextStatus = entry.status === "open" ? "done" : "open";
    const optimisticEntry = { ...entry, status: nextStatus, is_pending_sync: true };

    await updateEntries((currentEntries) =>
      sortEntries(
        currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? optimisticEntry : currentEntry))
      )
    );

    if (nextStatus === "done") {
      setRecentlyUsed((currentItems) => upsertRecentlyUsedItems(currentItems, entry));
    }

    try {
      setEntryError("");
      const result = await updateEntry(id, entry.id, token, { status: nextStatus });

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

      if (nextStatus === "done" && !result?.queued) {
        setRecentlyUsed((currentItems) =>
          upsertRecentlyUsedItems(currentItems, result?.entry ?? entry)
        );
      }
    } catch (submitError) {
      await updateEntries((currentEntries) =>
        sortEntries(currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? entry : currentEntry)))
      );

      if (nextStatus === "done") {
        setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== entry.text));
      }

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
        setShareNotice(t("share.inviteQueued", { email: shareEmail.trim() }));
      } else if (result?.invite?.invited_email) {
        setShareNotice(t("share.inviteSent", { email: result.invite.invited_email }));
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
                  ariaLabel: t("list.optionsAction"),
                  icon: <Icon color="var(--text-secondary)" name="moreVertical" size={20} />,
                  onClick: () => setShowOptions(true)
                }
              ]
            : []
        }
        title={list?.name ?? t("list.fallbackTitle")}
        onBack={() => navigate("/")}
      />

      <div className="detail-content">
        {list ? (
          <div className="detail-meta">
            <div className="list-card-chips">
              <span className={list.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
                {list.is_owner ? t("common.owner") : `${t("common.shared")} · ${list.owner_name ?? t("common.anotherMember")}`}
              </span>
              {list.is_pending_sync ? <span className="eg-chip-queued">{t("common.queued")}</span> : null}
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
            </div>
            {shouldShowPushToggle && isPushSupported ? (
              <button
                className="eg-btn-secondary"
                disabled={!isPushReady}
                type="button"
                onClick={() => void handlePushToggle()}
              >
                {isSubscribed ? t("detail.notificationsOff") : t("detail.notificationsOn")}
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
                <span className="detail-section-label">{t("detail.openItems").toUpperCase()}</span>
                <span className="eg-chip-purple">{openEntries.length}</span>
              </div>

              {openEntries.length === 0 ? (
                <EmptyState body={t("detail.noOpenItems")} title={t("detail.allClearTitle")} />
              ) : (
                <div className="entry-tile-grid">
                  {openEntries.map((entry) => (
                    <EntryTile
                      key={entry.id}
                      entry={entry}
                      onEdit={() => setEditingEntry(entry)}
                      onToggle={() => void toggleStatus(entry)}
                    />
                  ))}
                </div>
              )}
            </section>

            <RecentlyUsedSection
              items={visibleRecentlyUsed}
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
