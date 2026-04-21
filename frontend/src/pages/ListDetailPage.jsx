import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createEntry, deleteEntry, fetchEntries, updateEntry } from "../api/entries";
import { useAuth } from "../context/AuthContext";

export default function ListDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const inputRef = useRef(null);
  const [entries, setEntries] = useState([]);
  const [newEntryText, setNewEntryText] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      setError("");
      setIsLoading(true);

      try {
        const result = await fetchEntries(id, token);

        if (isMounted) {
          setEntries(result.entries ?? []);
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

    void loadEntries();

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
      setError("");
      const result = await createEntry(id, token, { text: newEntryText });
      setEntries((currentEntries) => sortEntries([...currentEntries, result.entry]));
      setNewEntryText("");
      inputRef.current?.focus();
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  async function toggleStatus(entry) {
    try {
      setError("");
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
      setError(submitError.message);
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
      setError("");
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
      setError(submitError.message);
    }
  }

  async function handleDeleteEntry(entryId) {
    try {
      setError("");
      await deleteEntry(id, entryId, token);
      setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== entryId));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  const openEntries = entries.filter((entry) => entry.status === "open");
  const doneEntries = entries.filter((entry) => entry.status === "done");

  return (
    <div className="stack">
      <div className="overview-header">
        <div className="stack tight-stack">
          <span className="pill">Protected detail route</span>
          <p>List detail view for <strong>{id}</strong>.</p>
        </div>
        <Link className="button-secondary link-button" to="/">
          Back to lists
        </Link>
      </div>

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

      {error ? <p className="error-banner">{error}</p> : null}
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
