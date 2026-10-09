import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AuthExpiredError } from "../../api/client";
import { writeCachedResource } from "../../api/offlineStore";
import { renameList } from "../../api/lists";
import { revokeListMember, shareListWithMember } from "../../api/sharing";
import EntryTile from "../../components/EntryTile/EntryTile";
import RecentlyUsedSection from "../../components/RecentlyUsedSection/RecentlyUsedSection";
import DeferredSheet from "../../components/ui/DeferredSheet/DeferredSheet";
import EmptyState from "../../components/ui/EmptyState/EmptyState";
import FAB from "../../components/ui/FAB/FAB";
import Icon from "../../components/ui/Icon/Icon";
import LoadingState from "../../components/ui/LoadingState/LoadingState";
import TopBar from "../../components/ui/TopBar/TopBar";
import { useAuth } from "../../context/AuthContext";
import { useEventSource } from "../../context/EventSourceContext";
import { useListEvents } from "../../hooks/useListEvents";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { getRecentlyUsedDisplayState } from "../recentlyUsedState";
import { leaveSharedList } from "../leaveListAction";
import styles from "./ListDetailPage.module.css";
import { getChangeKind, getErrorMessage, getInitials, isShareInviteResult } from "./listDetailUtils";
import { useEntryTiles } from "./useEntryTiles";
import { useListDetailData } from "./useListDetailData";
import { useListLifecycleEvents } from "./useListLifecycleEvents";
import { AddItemSheet, ListOptionsSheet, RenameListSheet, ShareListSheet } from "./lazySheets";
import type { DetailEntry, DetailMember } from "./useListDetailData";

export default function ListDetailPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const listId = id ?? "";
  const { token, user } = useAuth();
  const { resolvedIds, syncVersion } = useOfflineQueue();
  const { resyncVersion } = useEventSource();
  const lastResyncRef = useRef(resyncVersion);
  const [shareEmail, setShareEmail] = useState<string>("");
  const [shareError, setShareError] = useState<string>("");
  const [shareNotice, setShareNotice] = useState<string>("");
  const [isShareSubmitting, setIsShareSubmitting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showAddItem, setShowAddItem] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<DetailEntry | null>(null);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [showRename, setShowRename] = useState<boolean>(false);
  const [showShare, setShowShare] = useState<boolean>(false);
  const resetShareFeedback = useCallback(() => { setShareError(""); setShareNotice(""); }, []);
  const closeOwnerOnlySheets = useCallback(() => {
    setShowOptions(false);
    setShowRename(false);
    setShowShare(false);
  }, []);
  const {
    entries,
    entryError,
    handleEntryCreated,
    handleEntryDeleted,
    handleEntryUpdated,
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
    dismissRecentlyUsedEntry,
    setEntryError,
    setList,
    setMembers,
    submitEditEntry,
    toggleStatus
  } = useListDetailData({
    currentUserId: user?.id,
    listId,
    onLoadStart: resetShareFeedback,
    onNonOwnerList: closeOwnerOnlySheets,
    resolvedIds,
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

  const handleMemberChange = useCallback(() => void loadMembers({ isOwner: list?.is_owner ?? false }), [list?.is_owner, loadMembers]);
  const handleHistoryChange = useCallback(() => void reloadHistory(), [reloadHistory]);
  useEffect(() => {
    // Mount already loads the page; later versions refresh in place. A lower counter = token change reset.
    if (resyncVersion < lastResyncRef.current) lastResyncRef.current = resyncVersion;
    if (lastResyncRef.current === resyncVersion || isLoading) return;
    lastResyncRef.current = resyncVersion;
    void loadEntries().then((nextEntries) => Promise.all([
      reloadHistory(nextEntries),
      loadMembers({ isOwner: list?.is_owner ?? false })
    ]));
  }, [resyncVersion, isLoading, loadEntries, reloadHistory, loadMembers, list?.is_owner]);

  // Entry events patch the local entries from their payload; no entries request per event.
  useListEvents("entry:created", listId, handleEntryCreated);
  useListEvents("entry:updated", listId, handleEntryUpdated);
  useListEvents("entry:deleted", listId, handleEntryDeleted);
  useListEvents("history:updated", listId, handleHistoryChange);
  useListEvents("member:added", listId, handleMemberChange);
  // Deleted list, own removal (back to the overview with a notice) and rename (title in place).
  useListLifecycleEvents({ currentUserId: user?.id, listId, onOtherMemberRemoved: handleMemberChange, setList, token });

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

  async function handleLeave(): Promise<void> {
    await leaveSharedList({
      confirmMessage: t("list.leaveConfirm"),
      listId,
      token,
      onError: (error) => setEntryError(getErrorMessage(error)),
      onSuccess: () => navigate("/")
    });
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

  const { handleEdit, handleToggle, normalizedSearchQuery, openEntries, visibleEntries } = useEntryTiles({
    entries,
    onEdit: setEditingEntry,
    onToggle: (entry) => void toggleStatus(entry),
    searchQuery
  });
  const { changedDoneTexts, visibleRecentlyUsed } = getRecentlyUsedDisplayState(recentlyUsed, entries, openEntries);
  const visibleMemberBadges = list?.is_owner ? members.filter((member) => !member.is_owner) : [];
  const shouldSuppressEntryError = entryError instanceof AuthExpiredError;

  return (
    <div>
      <TopBar
        actions={
          list
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
          <div className="detail-banner eg-error-banner">{getErrorMessage(entryError, t("detail.accessError"))}</div>
        ) : null}
        {isLoading ? <LoadingState rows={4} /> : null}

        {!isLoading ? (
          <>
            <section className="entry-section">
              <div className="entry-section-header">
                <span className="detail-section-label">{t("detail.openItems").toUpperCase()}</span>
                <span className="eg-chip-purple">{openEntries.length}</span>
              </div>

              <input
                aria-label={t("detail.searchPlaceholder")}
                className={styles["detail-search"]}
                placeholder={t("detail.searchPlaceholder")}
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />

              {visibleEntries.length === 0 ? (
                normalizedSearchQuery ? (
                  <EmptyState body={t("detail.noSearchResults")} title={t("detail.noSearchResultsTitle")} />
                ) : (
                  <EmptyState body={t("detail.noOpenItems")} title={t("detail.allClearTitle")} />
                )
              ) : (
                <div className={styles["entry-tile-grid"]} data-testid="entry-tile-grid">
                  {visibleEntries.map((entry) => (
                    <EntryTile
                      key={entry.id}
                      changeKind={getChangeKind(entry)}
                      entry={entry}
                      onEdit={handleEdit}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              )}
            </section>

            <RecentlyUsedSection
              changedDoneTexts={changedDoneTexts}
              items={visibleRecentlyUsed}
              onAdd={(text, icon, details) => void addRecentlyUsedEntry(text, icon, details)}
              onDismiss={dismissRecentlyUsedEntry}
            />
          </>
        ) : null}
      </div>

      {list ? <FAB onClick={() => setShowAddItem(true)} /> : null}
      <DeferredSheet open={showAddItem}>
        <AddItemSheet
          listId={listId}
          open={showAddItem}
          onAdd={(text, icon, details) => addEntryByText(text, icon, details)}
          onClose={() => setShowAddItem(false)}
        />
      </DeferredSheet>
      <DeferredSheet open={Boolean(editingEntry)}>
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
      </DeferredSheet>
      <DeferredSheet open={showOptions}>
        <ListOptionsSheet
          isOwner={list?.is_owner ?? false}
          open={showOptions}
          onClose={() => setShowOptions(false)}
          onLeaveSelect={() => void handleLeave()}
          onRenameSelect={() => setShowRename(true)}
          onShareSelect={() => setShowShare(true)}
        />
      </DeferredSheet>
      <DeferredSheet open={showRename}>
        <RenameListSheet
          currentName={list?.name ?? ""}
          open={showRename}
          onClose={() => setShowRename(false)}
          onRename={handleRename}
        />
      </DeferredSheet>
      <DeferredSheet open={showShare}>
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
      </DeferredSheet>
    </div>
  );
}
