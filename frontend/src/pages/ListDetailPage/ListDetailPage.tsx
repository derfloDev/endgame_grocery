import { useCallback, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AuthExpiredError } from "../../api/client";
import { writeCachedResource } from "../../api/offlineStore";
import { renameList } from "../../api/lists";
import { revokeListMember, shareListWithMember } from "../../api/sharing";
import AddItemSheet from "../../components/AddItemSheet/AddItemSheet";
import EntryTile from "../../components/EntryTile/EntryTile";
import ListOptionsSheet from "../../components/ListOptionsSheet/ListOptionsSheet";
import RecentlyUsedSection from "../../components/RecentlyUsedSection/RecentlyUsedSection";
import RenameListSheet from "../../components/RenameListSheet/RenameListSheet";
import ShareListSheet from "../../components/ShareListSheet/ShareListSheet";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import FAB from "../../components/ui/FAB/FAB";
import Icon from "../../components/ui/Icon/Icon";
import LoadingState from "../../components/ui/LoadingState/LoadingState";
import TopBar from "../../components/ui/TopBar/TopBar";
import { useAuth } from "../../context/AuthContext";
import { useListEvents } from "../../hooks/useListEvents";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { filterRecentlyUsedItems } from "../recentlyUsedState";
import styles from "./ListDetailPage.module.css";
import { useListDetailData } from "./useListDetailData";
import type { DetailEntry, DetailMember } from "./useListDetailData";

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
  const [shareEmail, setShareEmail] = useState<string>("");
  const [shareError, setShareError] = useState<string>("");
  const [shareNotice, setShareNotice] = useState<string>("");
  const [isShareSubmitting, setIsShareSubmitting] = useState<boolean>(false);
  const [showAddItem, setShowAddItem] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<DetailEntry | null>(null);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [showRename, setShowRename] = useState<boolean>(false);
  const [showShare, setShowShare] = useState<boolean>(false);
  const resetShareFeedback = useCallback(() => {
    setShareError("");
    setShareNotice("");
  }, []);
  const closeOwnerOnlySheets = useCallback(() => {
    setShowOptions(false);
    setShowRename(false);
    setShowShare(false);
  }, []);
  const {
    entries,
    entryError,
    isLoading,
    isSharingLoading,
    list,
    loadEntries,
    loadMembers,
    members,
    recentlyUsed,
    reloadHistory,
    addEntryByText,
    addRecentlyUsedEntry,
    setEntryError,
    setList,
    setMembers,
    submitEditEntry,
    toggleStatus
  } = useListDetailData({
    accessErrorMessage: t("detail.accessError"),
    listId,
    onLoadStart: resetShareFeedback,
    onNonOwnerList: closeOwnerOnlySheets,
    syncVersion,
    token
  });
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

  const handleEntryChange = useCallback(() => {
    void loadEntries().then((nextEntries) => reloadHistory(nextEntries));
  }, [loadEntries, reloadHistory]);

  const handleMemberChange = useCallback(() => {
    void loadMembers({ isOwner: list?.is_owner ?? false });
  }, [list?.is_owner, loadMembers]);

  useListEvents("entry:created", listId, handleEntryChange);
  useListEvents("entry:updated", listId, handleEntryChange);
  useListEvents("entry:deleted", listId, handleEntryChange);
  useListEvents("member:added", listId, handleMemberChange);
  useListEvents("member:removed", listId, handleMemberChange);

  async function updateMembers(updater: (currentMembers: DetailMember[]) => DetailMember[]): Promise<void> {
    let nextMembers: DetailMember[] = [];

    setMembers((currentMembers) => {
      nextMembers = updater(currentMembers);
      return nextMembers;
    });

    await writeCachedResource(`members:${listId}`, { members: nextMembers });
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
  const shouldSuppressEntryError = entryError instanceof AuthExpiredError;

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

        {entryError && !shouldSuppressEntryError ? (
          <div className="detail-banner eg-error-banner">{getErrorMessage(entryError)}</div>
        ) : null}
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
              onAdd={(text, icon, details) => void addRecentlyUsedEntry(text, icon, details)}
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
