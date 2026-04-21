import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createEntry, deleteEntry, fetchEntries, updateEntry } from "../api/entries";
import { fetchLists } from "../api/lists";
import { fetchListMembers, revokeListMember, shareListWithMember } from "../api/sharing";
import { useAuth } from "../context/AuthContext";

export default function ListDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const inputRef = useRef(null);
  const [list, setList] = useState(null);
  const [entries, setEntries] = useState([]);
  const [members, setMembers] = useState([]);
  const [newEntryText, setNewEntryText] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [entryError, setEntryError] = useState("");
  const [shareError, setShareError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSharingOpen, setIsSharingOpen] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadListDetail() {
      setEntryError("");
      setShareError("");
      setIsLoading(true);

      try {
        const [listsResult, entriesResult] = await Promise.all([fetchLists(token), fetchEntries(id, token)]);
        const activeList = (listsResult.lists ?? []).find((candidate) => candidate.id === id);

        if (isMounted) {
          if (!activeList) {
            setEntryError("You no longer have access to this list.");
            setList(null);
            setEntries([]);
            setMembers([]);
            return;
          }

          setList(activeList);
          setEntries(entriesResult.entries ?? []);
        }

        if (activeList?.is_owner) {
          setIsSharingLoading(true);
          const membersResult = await fetchListMembers(id, token);

          if (isMounted) {
            setMembers(membersResult.members ?? []);
          }
        } else if (isMounted) {
          setMembers([]);
        }
      } catch (loadError) {
        if (isMounted) {
          setEntryError(loadError.message);
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
  }, [id, token]);

  async function handleCreateEntry(event) {
    event.preventDefault();

    if (!newEntryText.trim()) {
      return;
    }

    try {
      setEntryError("");
      const result = await createEntry(id, token, { text: newEntryText });
      setEntries((currentEntries) => sortEntries([...currentEntries, result.entry]));
      setNewEntryText("");
      inputRef.current?.focus();
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function toggleStatus(entry) {
    try {
      setEntryError("");
      const result = await updateEntry(id, entry.id, token, {
        status: entry.status === "open" ? "done" : "open"
      });
      setEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === entry.id ? { ...currentEntry, ...result.entry } : currentEntry
          )
        )
      );
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  function startEditing(entry) {
    setEditingId(entry.id);
    setEditingText(entry.text);
  }

  async function submitEdit(entryId) {
    if (!editingText.trim()) {
      return;
    }

    try {
      setEntryError("");
      const result = await updateEntry(id, entryId, token, { text: editingText });
      setEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) =>
            currentEntry.id === entryId ? { ...currentEntry, ...result.entry } : currentEntry
          )
        )
      );
      setEditingId("");
      setEditingText("");
    } catch (submitError) {
      setEntryError(submitError.message);
    }
  }

  async function handleDeleteEntry(entryId) {
    try {
      setEntryError("");
      await deleteEntry(id, entryId, token);
      setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
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
      setMembers((currentMembers) => [...currentMembers, result.member]);
      setShareEmail("");
    } catch (submitError) {
      setShareError(submitError.message);
    }
  }

  async function handleRevokeMember(memberId) {
    try {
      setShareError("");
      await revokeListMember(id, memberId, token);
      setMembers((currentMembers) => currentMembers.filter((member) => member.user_id !== memberId));
    } catch (submitError) {
      setShareError(submitError.message);
    }
  }

  const openEntries = entries.filter((entry) => entry.status === "open");
  const doneEntries = entries.filter((entry) => entry.status === "done");

  return (
    <div className="stack">
      <div className="overview-header">
        <div className="stack tight-stack">
          <span
            className={`pill ${list?.is_owner ? "" : "shared-pill"}`}
            title={list?.is_owner ? "You own this list." : `Owned by ${list?.owner_name ?? "another member"}`}
          >
            {list?.is_owner ? "Owner" : "Shared list"}
          </span>
          <h1 className="detail-title">{list?.name ?? "List detail"}</h1>
          <p>
            {list?.is_owner
              ? "You can add entries and manage members from this view."
              : `Shared by ${list?.owner_name ?? "another member"}. You can edit entries, but only the owner can manage access.`}
          </p>
        </div>
        <div className="button-row">
          {list?.is_owner ? (
            <button
              className="button-secondary"
              type="button"
              onClick={() => setIsSharingOpen((currentValue) => !currentValue)}
            >
              {isSharingOpen ? "Hide sharing" : "Manage sharing"}
            </button>
          ) : null}
          <Link className="button-secondary link-button" to="/">
            Back to lists
          </Link>
        </div>
      </div>

      {list?.is_owner && isSharingOpen ? (
        <section className="sharing-panel stack">
          <div className="overview-header">
            <div className="stack tight-stack">
              <h2 className="card-title">Share list</h2>
              <p>Add another registered user by email, then revoke access here if needed.</p>
            </div>
            <span className="pill shared-pill">{members.length} access entries</span>
          </div>

          <form className="auth-form compact-form" onSubmit={handleShareSubmit}>
            <div className="field">
              <label htmlFor="share-email">Share with email</label>
              <input
                id="share-email"
                name="email"
                placeholder="alex@example.com"
                value={shareEmail}
                onChange={(event) => setShareEmail(event.target.value)}
              />
            </div>
            <div className="button-row">
              <button className="button-primary" type="submit">
                Add member
              </button>
            </div>
          </form>

          {shareError ? <p className="error-banner">{shareError}</p> : null}
          {isSharingLoading ? <p>Loading members...</p> : null}

          {!isSharingLoading ? (
            <div className="stack">
              {members.map((member) => (
                <article key={member.user_id} className="member-card">
                  <div className="stack tight-stack">
                    <div className="button-row">
                      <h3 className="member-name">{member.display_name}</h3>
                      <span className={`pill ${member.is_owner ? "" : "shared-pill"}`}>
                        {member.is_owner ? "Owner" : "Member"}
                      </span>
                    </div>
                    <p>{member.email}</p>
                  </div>
                  {!member.is_owner ? (
                    <button
                      className="button-secondary destructive-button"
                      type="button"
                      onClick={() => void handleRevokeMember(member.user_id)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <form className="auth-form compact-form" onSubmit={handleCreateEntry}>
        <div className="field">
          <label htmlFor="new-entry-text">Add item</label>
          <input
            ref={inputRef}
            id="new-entry-text"
            name="text"
            placeholder="Add milk, lemons, bread..."
            value={newEntryText}
            onChange={(event) => setNewEntryText(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="button-primary" type="submit">
            Add item
          </button>
        </div>
      </form>

      {entryError ? <p className="error-banner">{entryError}</p> : null}
      {isLoading ? <p>Loading entries...</p> : null}

      {!isLoading ? (
        <div className="stack">
          <section className="entry-section">
            <div className="overview-header">
              <h2 className="card-title">Open items</h2>
              <span className="pill">{openEntries.length}</span>
            </div>
            {openEntries.length === 0 ? <p>No open items yet.</p> : null}
            <div className="stack">
              {openEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  editingId={editingId}
                  editingText={editingText}
                  onDelete={handleDeleteEntry}
                  onEditChange={setEditingText}
                  onStartEdit={startEditing}
                  onSubmitEdit={submitEdit}
                  onToggle={toggleStatus}
                />
              ))}
            </div>
          </section>

          <section className="entry-section">
            <div className="overview-header">
              <h2 className="card-title">Done items</h2>
              <span className="pill shared-pill">{doneEntries.length}</span>
            </div>
            {doneEntries.length === 0 ? <p>No done items yet.</p> : null}
            <div className="stack">
              {doneEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  editingId={editingId}
                  editingText={editingText}
                  onDelete={handleDeleteEntry}
                  onEditChange={setEditingText}
                  onStartEdit={startEditing}
                  onSubmitEdit={submitEdit}
                  onToggle={toggleStatus}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function EntryCard({
  entry,
  editingId,
  editingText,
  onDelete,
  onEditChange,
  onStartEdit,
  onSubmitEdit,
  onToggle
}) {
  return (
    <article className={`entry-card ${entry.status === "done" ? "entry-card-done" : ""}`}>
      <button className="entry-toggle" type="button" onClick={() => void onToggle(entry)}>
        {entry.status === "done" ? "Reopen" : "Done"}
      </button>
      <div className="stack tight-stack entry-copy">
        {editingId === entry.id ? (
          <>
            <label className="visually-hidden" htmlFor={`entry-edit-${entry.id}`}>
              Edit entry
            </label>
            <input
              id={`entry-edit-${entry.id}`}
              value={editingText}
              onChange={(event) => onEditChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSubmitEdit(entry.id);
                }
              }}
            />
          </>
        ) : (
          <p className={`entry-text ${entry.status === "done" ? "entry-text-done" : ""}`}>{entry.text}</p>
        )}
      </div>
      <div className="button-row">
        {editingId === entry.id ? (
          <>
            <button className="button-secondary" type="button" onClick={() => void onSubmitEdit(entry.id)}>
              Save
            </button>
            <button className="button-secondary" type="button" onClick={() => onEditChange(entry.text)}>
              Reset
            </button>
          </>
        ) : (
          <button className="button-secondary" type="button" onClick={() => onStartEdit(entry)}>
            Edit
          </button>
        )}
        <button className="button-secondary destructive-button" type="button" onClick={() => void onDelete(entry.id)}>
          Delete
        </button>
      </div>
    </article>
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
