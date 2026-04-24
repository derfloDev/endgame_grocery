import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createTemporaryId } from "../api/client";
import { createEntry, deleteEntry, fetchEntries, updateEntry } from "../api/entries";
import { writeCachedResource } from "../api/offlineStore";
import { fetchLists } from "../api/lists";
import { fetchListMembers, revokeListMember, shareListWithMember } from "../api/sharing";
import AddItemSheet from "../components/AddItemSheet";
import EntryRow from "../components/EntryRow";
import { EmptyState, FAB, Icon, LoadingState, TopBar } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

export default function ListDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token } = useAuth();
  const { syncVersion } = useOfflineQueue();
  const [list, setList] = useState(null);
  const [entries, setEntries] = useState([]);
  const [members, setMembers] = useState([]);
  const [shareEmail, setShareEmail] = useState("");
  const [entryError, setEntryError] = useState("");
  const [shareError, setShareError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [doneOpen, setDoneOpen] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadListDetail() {
      setEntryError("");
      setShareError("");
      setIsLoading(true);

      try {
        const [listsResult, entriesResult] = await Promise.all([fetchLists(token), fetchEntries(id, token)]);
        const activeList = (listsResult.lists ?? []).find((candidate) => candidate.id === id);

        if (!isMounted) {
          return;
        }

        if (!activeList) {
          setEntryError("You no longer have access to this list.");
          setList(null);
          setEntries([]);
          setMembers([]);
          return;
        }

        setList(activeList);
        setEntries(entriesResult.entries ?? []);

        if (activeList.is_owner) {
          setIsSharingLoading(true);
          const membersResult = await fetchListMembers(id, token);

          if (isMounted) {
            setMembers(membersResult.members ?? []);
          }
        } else {
          setMembers([]);
          setIsSharingOpen(false);
        }
      } catch (loadError) {
        if (isMounted) {
          setEntryError(loadError.message);
          setList(null);
          setEntries([]);
          setMembers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsSharingLoading(false);
        }
      }
    }

    void loadListDetail();

    return () => {
      isMounted = false;
    };
  }, [id, syncVersion, token]);

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

  async function addEntryByText(text) {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    try {
      setEntryError("");

      const temporaryEntry = {
        id: createTemporaryId("entry"),
        text: trimmed,
        status: "open",
        created_at: new Date().toISOString(),
        is_pending_sync: true
      };
      const result = await createEntry(id, token, { text: trimmed }, { tempId: temporaryEntry.id });

      await updateEntries((currentEntries) =>
        sortEntries([...currentEntries, result?.queued ? temporaryEntry : result.entry])
      );
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function toggleStatus(entry) {
    try {
      setEntryError("");
      const nextStatus = entry.status === "open" ? "done" : "open";
      const result = await updateEntry(id, entry.id, token, {
        status: nextStatus
      });

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
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function submitEditEntry(entryId, text) {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    try {
      setEntryError("");
      const result = await updateEntry(id, entryId, token, { text: trimmed });

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === entryId
              ? {
                  ...currentEntry,
                  ...(result?.queued ? { is_pending_sync: true, text: trimmed } : result.entry)
                }
              : currentEntry
          )
        )
      );
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function handleDeleteEntry(entryId) {
    try {
      setEntryError("");
      await deleteEntry(id, entryId, token);
      await updateEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function handleShareSubmit(event) {
    event.preventDefault();

    if (!shareEmail.trim()) {
      return;
    }

    try {
      setShareError("");
      const result = await shareListWithMember(id, token, { email: shareEmail });

      await updateMembers((currentMembers) => [
        ...currentMembers,
        result?.queued
          ? {
              user_id: createTemporaryId("member"),
              display_name: shareEmail.trim(),
              email: shareEmail.trim(),
              is_owner: false,
              is_pending_sync: true
            }
          : result.member
      ]);
      setShareEmail("");
    } catch (submitError) {
      setShareError(submitError.message);
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

  const openEntries = entries.filter((entry) => entry.status === "open");
  const doneEntries = entries.filter((entry) => entry.status === "done");

  return (
    <div className="detail-page">
      <TopBar
        actions={
          list?.is_owner
            ? [
                {
                  ariaLabel: "Share list",
                  icon: <Icon color="var(--text-secondary)" name="share" size={20} />,
                  onClick: () => setIsSharingOpen((currentValue) => !currentValue)
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
                    onDelete={() => void handleDeleteEntry(entry.id)}
                    onEdit={(text) => void submitEditEntry(entry.id, text)}
                    onToggle={() => void toggleStatus(entry)}
                  />
                ))
              )}
            </section>

            {doneEntries.length > 0 ? (
              <section className="entry-section">
                <button
                  aria-label="Toggle done items"
                  className="entry-section-collapse"
                  type="button"
                  onClick={() => setDoneOpen((currentValue) => !currentValue)}
                >
                  <span className="detail-section-label detail-section-label-done">DONE</span>
                  <span className="eg-chip-success">{doneEntries.length}</span>
                  <Icon
                    color="var(--color-success)"
                    name={doneOpen ? "chevronDown" : "chevronRight"}
                    size={16}
                  />
                </button>

                {doneOpen
                  ? doneEntries.map((entry) => (
                      <EntryRow
                        key={entry.id}
                        entry={entry}
                        onDelete={() => void handleDeleteEntry(entry.id)}
                        onEdit={(text) => void submitEditEntry(entry.id, text)}
                        onToggle={() => void toggleStatus(entry)}
                      />
                    ))
                  : null}
              </section>
            ) : null}

            {list?.is_owner && isSharingOpen ? (
              <SharingPanel
                isSharingLoading={isSharingLoading}
                members={members}
                shareEmail={shareEmail}
                shareError={shareError}
                onEmailChange={setShareEmail}
                onRevoke={handleRevokeMember}
                onShareSubmit={handleShareSubmit}
              />
            ) : null}
          </>
        ) : null}
      </div>

      {list ? <FAB onClick={() => setShowAddItem(true)} /> : null}
      <AddItemSheet
        open={showAddItem}
        onAdd={(text) => void addEntryByText(text)}
        onClose={() => setShowAddItem(false)}
      />
    </div>
  );
}

function SharingPanel({ members, shareEmail, shareError, isSharingLoading, onEmailChange, onShareSubmit, onRevoke }) {
  return (
    <section className="sharing-panel">
      <div className="entry-section-header">
        <span className="detail-section-label detail-section-label-share">SQUAD</span>
        <span className="eg-chip-purple">{members.length}</span>
      </div>

      <form className="sharing-panel-form" onSubmit={onShareSubmit}>
        <div className="eg-field">
          <label htmlFor="share-email">Share with email</label>
          <input
            id="share-email"
            className="eg-input"
            placeholder="Share with email..."
            value={shareEmail}
            onChange={(event) => onEmailChange(event.target.value)}
          />
        </div>
        <button className="eg-btn-secondary" type="submit">
          Add Member
        </button>
      </form>

      {shareError ? <div className="detail-banner eg-error-banner">{shareError}</div> : null}
      {isSharingLoading ? <LoadingState rows={2} /> : null}

      {!isSharingLoading
        ? members.map((member) => (
            <div key={member.user_id} className="member-row">
              <div className="member-row-copy">
                <div className="member-row-name">{member.display_name}</div>
                <div className="member-row-email">{member.email}</div>
              </div>
              <div className="member-row-actions">
                <span className={member.is_owner ? "eg-chip-purple" : "eg-chip-cyan"}>
                  {member.is_owner ? "Owner" : "Member"}
                </span>
                {member.is_pending_sync ? <span className="eg-chip-queued">Queued</span> : null}
                {!member.is_owner ? (
                  <button
                    className="eg-btn-danger member-row-revoke"
                    type="button"
                    onClick={() => void onRevoke(member.user_id)}
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            </div>
          ))
        : null}
    </section>
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
