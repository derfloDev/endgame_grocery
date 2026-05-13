import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { createTemporaryId } from "../../api/client";
import { createEntry, fetchEntries, updateEntry } from "../../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../../api/history";
import { writeCachedResource } from "../../api/offlineStore";
import { fetchLists, renameList } from "../../api/lists";
import { fetchListMembers, revokeListMember, shareListWithMember } from "../../api/sharing";
import AddItemSheet from "../../components/AddItemSheet/AddItemSheet";
import EntryTile from "../../components/EntryTile/EntryTile";
import ListOptionsSheet from "../../components/ListOptionsSheet/ListOptionsSheet";
import RecentlyUsedSection from "../../components/RecentlyUsedSection/RecentlyUsedSection";
import RenameListSheet from "../../components/RenameListSheet/RenameListSheet";
import ShareListSheet from "../../components/ShareListSheet/ShareListSheet";
import { EmptyState, FAB, Icon, LoadingState, TopBar } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { useListEvents } from "../../hooks/useListEvents";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import type { Entry, List, Member, Suggestion } from "../../types";
import { filterRecentlyUsedItems, upsertRecentlyUsedItems } from "../recentlyUsedState";
import styles from "./ListDetailPage.module.css";

interface DetailEntry extends Omit<Entry, "details"> {
  details?: string | null;
  created_at?: string;
  is_pending_sync?: boolean;
}

interface DetailList extends List {
  name?: string;
  owner_name?: string;
  is_pending_sync?: boolean;
}

interface DetailMember extends Member {
  user_id: string;
  display_name: string;
  email: string;
  is_owner?: boolean;
  is_pending_sync?: boolean;
}

interface LoadEntriesOptions {
  historyItems?: Suggestion[] | null;
  throwOnError?: boolean;
}

interface LoadMembersOptions {
  isOwner?: boolean;
  throwOnError?: boolean;
}

interface ShareInviteResult {
  queued?: boolean;
  invite?: {
    invited_email?: string;
  };
}

function isShareInviteResult(value: unknown): value is ShareInviteResult {
  return Boolean(value) && typeof value === "object";
}

export default function ListDetailPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const listId = id ?? "";
  const { token } = useAuth();
  const { syncVersion } = useOfflineQueue();
  const [list, setList] = useState<DetailList | null>(null);
  const [entries, setEntries] = useState<DetailEntry[]>([]);
  const [members, setMembers] = useState<DetailMember[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<Suggestion[]>([]);
  const [shareEmail, setShareEmail] = useState<string>("");
  const [entryError, setEntryError] = useState<string>("");
  const [shareError, setShareError] = useState<string>("");
  const [shareNotice, setShareNotice] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isShareSubmitting, setIsShareSubmitting] = useState<boolean>(false);
  const [isSharingLoading, setIsSharingLoading] = useState<boolean>(false);
  const [showAddItem, setShowAddItem] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<DetailEntry | null>(null);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [showRename, setShowRename] = useState<boolean>(false);
  const [showShare, setShowShare] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const shouldShowPushToggle = list !== null && (!list.is_owner || members.length > 1);
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
    async ({ historyItems = null, throwOnError = false }: LoadEntriesOptions = {}): Promise<DetailEntry[]> => {
      try {
        const entriesResult = await fetchEntries(listId, token);
        const nextEntries = (entriesResult.entries ?? []) as DetailEntry[];

        if (isMountedRef.current) {
          setEntries(nextEntries);
          setRecentlyUsed((currentItems) => filterRecentlyUsedItems(historyItems ?? currentItems, nextEntries));
        }

        return nextEntries;
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(getErrorMessage(loadError));
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      }
    },
    [listId, token]
  );

  const loadMembers = useCallback(
    async ({ isOwner = false, throwOnError = false }: LoadMembersOptions = {}): Promise<DetailMember[]> => {
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
        const membersResult = await fetchListMembers(listId, token);
        const nextMembers = (membersResult.members ?? []) as DetailMember[];

        if (isMountedRef.current) {
          setMembers(nextMembers);
        }

        return nextMembers;
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(getErrorMessage(loadError));
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
    [listId, token]
  );

  useEffect(() => {
    async function loadListDetail(): Promise<void> {
      setEntryError("");
      setShareError("");
      setShareNotice("");
      setIsLoading(true);
      setRecentlyUsed([]);

      try {
        const [listsResult, entriesResult, historyResult] = await Promise.all([
          fetchLists(token),
          fetchEntries(listId, token),
          fetchRecentlyUsed(listId, token).catch((error) => {
            console.error("Failed to load recently used history.", error);
            return { history: [] };
          })
        ]);
        const activeList = ((listsResult.lists ?? []) as DetailList[]).find((candidate) => candidate.id === listId);

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
        const nextEntries = (entriesResult.entries ?? []) as DetailEntry[];
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
          setEntryError(getErrorMessage(loadError));
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
  }, [listId, loadEntries, loadMembers, syncVersion, t, token]);

  const handleEntryChange = useCallback(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleMemberChange = useCallback(() => {
    void loadMembers({ isOwner: list?.is_owner ?? false });
  }, [list?.is_owner, loadMembers]);

  useListEvents("entry:created", listId, handleEntryChange);
  useListEvents("entry:updated", listId, handleEntryChange);
  useListEvents("entry:deleted", listId, handleEntryChange);
  useListEvents("member:added", listId, handleMemberChange);
  useListEvents("member:removed", listId, handleMemberChange);

  async function updateEntries(updater: (currentEntries: DetailEntry[]) => DetailEntry[]): Promise<void> {
    let nextEntries: DetailEntry[] = [];

    setEntries((currentEntries) => {
      nextEntries = updater(currentEntries);
      return nextEntries;
    });

    await writeCachedResource(`entries:${listId}`, { entries: nextEntries });
  }

  async function updateMembers(updater: (currentMembers: DetailMember[]) => DetailMember[]): Promise<void> {
    let nextMembers: DetailMember[] = [];

    setMembers((currentMembers) => {
      nextMembers = updater(currentMembers);
      return nextMembers;
    });

    await writeCachedResource(`members:${listId}`, { members: nextMembers });
  }

  async function addEntryByText(text: string, icon: string | null, details = ""): Promise<boolean> {
    const trimmed = text.trim();

    if (!trimmed) {
      return false;
    }

    const nextDetails = normalizeEntryDetails(details);
    const temporaryEntry: DetailEntry = {
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
        listId,
        token,
        { text: trimmed, icon: icon ?? null, details },
        { tempId: temporaryEntry.id }
      );

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === temporaryEntry.id
              ? result?.queued
                ? temporaryEntry
                : (result.entry as DetailEntry)
              : currentEntry
          )
        )
      );
      return true;
    } catch (submitError) {
      await updateEntries((currentEntries) =>
        currentEntries.filter((currentEntry) => currentEntry.id !== temporaryEntry.id)
      );
      setEntryError(getErrorMessage(submitError));
      return false;
    }
  }

  async function toggleStatus(entry: DetailEntry): Promise<void> {
    const nextStatus: Entry["status"] = entry.status === "open" ? "done" : "open";
    const optimisticEntry: DetailEntry = { ...entry, status: nextStatus, is_pending_sync: true };

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
      const result = await updateEntry(listId, entry.id, token, { status: nextStatus });

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === entry.id
              ? {
                  ...currentEntry,
                  ...(result?.queued ? { is_pending_sync: true, status: nextStatus } : (result.entry as DetailEntry))
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

      setEntryError(getErrorMessage(submitError));
    }
  }

  async function submitEditEntry(
    entryId: string,
    text: string,
    iconName: string | null,
    details = ""
  ): Promise<boolean> {
    const trimmed = text.trim();

    if (!trimmed) {
      return false;
    }

    try {
      setEntryError("");
      const nextIcon = iconName ?? null;
      const nextDetails = normalizeEntryDetails(details);
      const result = await updateEntry(listId, entryId, token, { text: trimmed, icon: nextIcon, details });

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === entryId
              ? {
                  ...currentEntry,
                  ...(result?.queued
                    ? { details: nextDetails, icon: nextIcon, is_pending_sync: true, text: trimmed }
                    : (result.entry as DetailEntry))
                }
              : currentEntry
          )
        )
      );
      return true;
    } catch (submitError) {
      setEntryError(getErrorMessage(submitError));
      return false;
    }
  }

  async function handleAddFromHistory(text: string, icon: string | null): Promise<void> {
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

  function handleDismissFromHistory(text: string): void {
    setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== text));

    void deleteFromHistory(listId, text, token).catch((error) => {
      console.error("Failed to delete recently used history item.", error);
    });
  }

  async function handleRename(newName: string): Promise<void> {
    try {
      setEntryError("");
      const result = await renameList(token, listId, { name: newName });
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
      setEntryError(getErrorMessage(submitError));
      throw submitError;
    }
  }

  async function handleShareSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!shareEmail.trim()) {
      return;
    }

    try {
      setIsShareSubmitting(true);
      setShareError("");
      setShareNotice("");
      const result = await shareListWithMember(listId, token, { email: shareEmail });

      if (isShareInviteResult(result) && result.queued) {
        setShareNotice(t("share.inviteQueued", { email: shareEmail.trim() }));
      } else if (isShareInviteResult(result) && result.invite?.invited_email) {
        setShareNotice(t("share.inviteSent", { email: result.invite.invited_email }));
      }

      setShareEmail("");
    } catch (submitError) {
      setShareError(getErrorMessage(submitError));
    } finally {
      setIsShareSubmitting(false);
    }
  }

  async function handleRevokeMember(memberId: string): Promise<void> {
    try {
      setShareError("");
      await revokeListMember(listId, memberId, token);
      await updateMembers((currentMembers) => currentMembers.filter((member) => member.user_id !== memberId));
    } catch (submitError) {
      setShareError(getErrorMessage(submitError));
    }
  }

  async function handlePushToggle(): Promise<void> {
    try {
      setEntryError("");

      if (isSubscribed) {
        await unsubscribe();
        return;
      }

      await subscribe();
    } catch (pushError) {
      setEntryError(getErrorMessage(pushError));
    }
  }

  const openEntries = entries.filter((entry) => entry.status === "open");
  const visibleRecentlyUsed = filterRecentlyUsedItems(recentlyUsed, openEntries);
  const visibleMemberBadges = list?.is_owner ? members.filter((member) => !member.is_owner) : [];

  return (
    <div>
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

      <div className={styles["detail-content"]}>
        {list ? (
          <div className={styles["detail-meta"]}>
            <div className="list-card-chips">
              <span className={list.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
                {list.is_owner ? t("common.owner") : `${t("common.shared")} · ${list.owner_name ?? t("common.anotherMember")}`}
              </span>
              {list.is_pending_sync ? <span className="eg-chip-queued">{t("common.queued")}</span> : null}
              {visibleMemberBadges.length > 0 ? (
                <div className={styles["detail-member-badges"]}>
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
                <div className={styles["entry-tile-grid"]} data-testid="entry-tile-grid">
                  {openEntries.map((entry) => (
                    <EntryTile
                      key={entry.id}
                      entry={{ ...entry, details: entry.details ?? undefined }}
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
        listId={listId}
        open={showAddItem}
        onAdd={(text, icon, details) => addEntryByText(text, icon, details)}
        onClose={() => setShowAddItem(false)}
      />
      <AddItemSheet
        initialDetails={editingEntry?.details ?? ""}
        initialIconName={editingEntry?.icon ?? null}
        initialText={editingEntry?.text ?? ""}
        listId={listId}
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

function sortEntries(entries: DetailEntry[]): DetailEntry[] {
  return [...entries].sort((left, right) => {
    if (left.status === right.status) {
      return new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime();
    }

    return left.status === "open" ? -1 : 1;
  });
}

function normalizeEntryDetails(details: string): string | null {
  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

function getInitials(name: unknown): string {
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
