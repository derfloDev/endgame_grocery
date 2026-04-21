import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createList, deleteList, fetchLists, renameList } from "../api/lists";
import { useAuth } from "../context/AuthContext";

export default function OverviewPage() {
  const { logout, token, user } = useAuth();
  const [lists, setLists] = useState([]);
  const [newListName, setNewListName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLists() {
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

    void loadLists();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleCreateList(event) {
    event.preventDefault();

    if (!newListName.trim()) {
      return;
    }

    try {
      setError("");
      const result = await createList(token, { name: newListName });
      setLists((currentLists) => [...currentLists, result.list]);
      setNewListName("");
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  function startEditing(list) {
    setEditingId(list.id);
    setEditingName(list.name);
  }

  async function submitRename(listId) {
    if (!editingName.trim()) {
      return;
    }

    try {
      setError("");
      const result = await renameList(token, listId, { name: editingName });
      setLists((currentLists) =>
        currentLists.map((list) => (list.id === listId ? { ...list, ...result.list } : list))
      );
      setEditingId("");
      setEditingName("");
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
      setLists((currentLists) => currentLists.filter((list) => list.id !== listId));
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="stack">
      <header className="overview-header">
        <div className="stack">
          <span className="pill">Authenticated session</span>
          <p>Signed in as user ID: {user?.id ?? "unknown"}</p>
          <p>Create a list, rename your own lists, and open any list you can access.</p>
        </div>
        <button className="button-secondary" type="button" onClick={logout}>
          Log out
        </button>
      </header>

      <form className="auth-form compact-form" onSubmit={handleCreateList}>
        <div className="field">
          <label htmlFor="new-list-name">New list</label>
          <input
            id="new-list-name"
            name="name"
            placeholder="Weekend groceries"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
          />
        </div>
        <div className="button-row">
          <button className="button-primary" type="submit">
            Create list
          </button>
        </div>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}

      {isLoading ? <p>Loading lists...</p> : null}

      {!isLoading && lists.length === 0 ? (
        <p>No lists yet. Create one to get started.</p>
      ) : (
        <div className="list-grid">
          {lists.map((list) => (
            <article key={list.id} className="list-card">
              <div className="stack">
                <div className="overview-header">
                  <div className="stack tight-stack">
                    <span className={`pill ${list.is_owner ? "" : "shared-pill"}`}>
                      {list.is_owner ? "Owner" : `Shared by ${list.owner_name}`}
                    </span>
                    {editingId === list.id ? (
                      <div className="stack tight-stack">
                        <label className="visually-hidden" htmlFor={`rename-${list.id}`}>
                          Rename list
                        </label>
                        <input
                          id={`rename-${list.id}`}
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void submitRename(list.id);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <h2 className="card-title">{list.name}</h2>
                    )}
                  </div>
                  <Link className="button-secondary link-button" to={`/lists/${list.id}`}>
                    Open
                  </Link>
                </div>

                <div className="button-row">
                  {list.is_owner ? (
                    <>
                      {editingId === list.id ? (
                        <>
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => void submitRename(list.id)}
                          >
                            Save name
                          </button>
                          <button
                            className="button-secondary"
                            type="button"
                            onClick={() => {
                              setEditingId("");
                              setEditingName("");
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => startEditing(list)}
                        >
                          Rename
                        </button>
                      )}
                      <button
                        className="button-secondary destructive-button"
                        type="button"
                        onClick={() => void handleDelete(list.id)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <p className="muted-text">Shared lists are visible here with their owner.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
