import { describe, expect, it } from "vitest";
import { applyEntryEvent, sortEntries } from "./listDetailUtils";
import type { DetailEntry } from "./useListDetailData";

const ME = "user-me";
const OTHER = "user-other";

function entry(overrides: Partial<DetailEntry> & { id: string }): DetailEntry {
  return {
    text: "Milk",
    status: "open",
    icon: null,
    details: null,
    created_at: "2026-04-01T10:00:00.000Z",
    updated_at: "2026-04-01T10:00:00.000Z",
    last_updated_by: OTHER,
    ...overrides
  } as DetailEntry;
}

function serverRow(overrides: Partial<DetailEntry> & { id: string }) {
  const { is_changed: _ignored, ...row } = entry(overrides);
  void _ignored;
  return row;
}

const options = { currentUserId: ME, locallyDoneIds: new Set<string>() };

describe("applyEntryEvent", () => {
  describe("entry:created and entry:updated", () => {
    it("adds a new entry marked as changed when somebody else wrote it", () => {
      const result = applyEntryEvent([], "entry:created", { entryId: "e1", entry: serverRow({ id: "e1" }) }, options)!;

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({ id: "e1", text: "Milk", is_changed: true });
      expect(result.historyChanged).toBe(false);
    });

    it("does not mark the own writes of another tab or device as changed", () => {
      const result = applyEntryEvent([], "entry:created", { entryId: "e1", entry: serverRow({ id: "e1", last_updated_by: ME }) }, options)!;

      expect(result.entries[0].is_changed).toBe(false);
    });

    it("keeps the list sorted: open before done, then by creation time", () => {
      const current = [
        entry({ id: "open-late", created_at: "2026-04-01T12:00:00.000Z" }),
        entry({ id: "done-1", status: "done", created_at: "2026-04-01T08:00:00.000Z" })
      ];

      const result = applyEntryEvent(current, "entry:created", { entryId: "open-early", entry: serverRow({ id: "open-early", created_at: "2026-04-01T09:00:00.000Z" }) }, options)!;

      expect(result.entries.map((candidate) => candidate.id)).toEqual(["open-early", "open-late", "done-1"]);
    });

    it("replaces the fields of an existing entry on update", () => {
      const current = [entry({ id: "e1", text: "Milk" })];

      const result = applyEntryEvent(
        current,
        "entry:updated",
        { entryId: "e1", entry: serverRow({ id: "e1", text: "Oat milk", details: "1 l", icon: "IconMilk", updated_at: "2026-04-01T11:00:00.000Z" }) },
        options
      )!;

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]).toMatchObject({ id: "e1", text: "Oat milk", details: "1 l", icon: "IconMilk", is_changed: true });
    });

    it("inserts an updated entry that this client never saw", () => {
      const result = applyEntryEvent([], "entry:updated", { entryId: "e9", entry: serverRow({ id: "e9", text: "Bread" }) }, options)!;

      expect(result.entries.map((candidate) => candidate.text)).toEqual(["Bread"]);
    });

    it("is idempotent: applying the same event again returns the identical array", () => {
      const event = { entryId: "e1", entry: serverRow({ id: "e1", text: "Oat milk", updated_at: "2026-04-01T11:00:00.000Z" }) };
      const once = applyEntryEvent([entry({ id: "e1" })], "entry:updated", event, options)!;

      const twice = applyEntryEvent(once.entries, "entry:updated", event, options)!;

      expect(twice.entries).toBe(once.entries);
      expect(twice.historyChanged).toBe(false);
    });

    it("applies a created event for an entry that already exists as a no-op", () => {
      const current = [entry({ id: "e1", last_updated_by: ME, is_changed: false })];

      const result = applyEntryEvent(current, "entry:created", { entryId: "e1", entry: serverRow({ id: "e1", last_updated_by: ME }) }, options)!;

      expect(result.entries).toBe(current);
    });

    it("keeps queued local entries that the server does not know yet", () => {
      const pending = entry({ id: "temp-entry-1", text: "Eggs", is_pending_sync: true });

      const result = applyEntryEvent([pending], "entry:created", { entryId: "e1", entry: serverRow({ id: "e1" }) }, options)!;

      expect(result.entries.map((candidate) => candidate.id).sort()).toEqual(["e1", "temp-entry-1"]);
      expect(result.entries.find((candidate) => candidate.id === "temp-entry-1")).toBe(pending);
    });

    it("leaves an entry alone while a local change to it is still in flight", () => {
      const inFlight = entry({ id: "e1", status: "done", is_pending_sync: true, is_changed: true });
      const current = [inFlight];

      const result = applyEntryEvent(current, "entry:updated", { entryId: "e1", entry: serverRow({ id: "e1", status: "open" }) }, options)!;

      expect(result.entries).toBe(current);
      expect(result.historyChanged).toBe(false);
    });

    it("keeps the done badge of an entry completed on this client", () => {
      const current = [entry({ id: "e1", status: "open" })];

      const result = applyEntryEvent(
        current,
        "entry:updated",
        { entryId: "e1", entry: serverRow({ id: "e1", status: "done", last_updated_by: ME }) },
        { currentUserId: ME, locallyDoneIds: new Set(["e1"]) }
      )!;

      expect(result.entries[0]).toMatchObject({ status: "done", is_changed: true });
    });

    it("does not mutate its input", () => {
      const current = [entry({ id: "e1" })];
      const snapshot = JSON.stringify(current);

      applyEntryEvent(current, "entry:updated", { entryId: "e1", entry: serverRow({ id: "e1", text: "Changed" }) }, options);

      expect(JSON.stringify(current)).toBe(snapshot);
    });
  });

  describe("entry:deleted", () => {
    it("removes the entry", () => {
      const current = [entry({ id: "e1" }), entry({ id: "e2", text: "Bread" })];

      const result = applyEntryEvent(current, "entry:deleted", { entryId: "e1", entryStatus: "open" }, options)!;

      expect(result.entries.map((candidate) => candidate.id)).toEqual(["e2"]);
    });

    it("is idempotent for an entry that is already gone", () => {
      const current = [entry({ id: "e2" })];

      const result = applyEntryEvent(current, "entry:deleted", { entryId: "e1", entryStatus: "open" }, options)!;

      expect(result.entries).toBe(current);
    });

    it("does not remove queued local entries", () => {
      const pending = entry({ id: "temp-entry-1", is_pending_sync: true });

      const result = applyEntryEvent([pending], "entry:deleted", { entryId: "e1", entryStatus: "open" }, options)!;

      expect(result.entries).toEqual([pending]);
    });
  });

  describe("recently used history", () => {
    it.each([
      ["open to done", "open", "done", true],
      ["done to open", "done", "open", true],
      ["open to open (edit)", "open", "open", false],
      ["done to done (edit)", "done", "done", false]
    ] as const)("%s", (_name, before, after, expected) => {
      const current = [entry({ id: "e1", status: before })];

      const result = applyEntryEvent(current, "entry:updated", { entryId: "e1", entry: serverRow({ id: "e1", status: after, text: "Changed" }) }, options)!;

      expect(result.historyChanged).toBe(expected);
    });

    it("reloads when an unknown entry arrives already done", () => {
      expect(applyEntryEvent([], "entry:updated", { entryId: "e1", entry: serverRow({ id: "e1", status: "done" }) }, options)!.historyChanged).toBe(true);
    });

    it("does not reload for a new open entry", () => {
      expect(applyEntryEvent([], "entry:created", { entryId: "e1", entry: serverRow({ id: "e1" }) }, options)!.historyChanged).toBe(false);
    });

    it("reloads when a done entry is deleted but not an open one", () => {
      const current = [entry({ id: "e1" })];

      expect(applyEntryEvent(current, "entry:deleted", { entryId: "e1", entryStatus: "done" }, options)!.historyChanged).toBe(true);
      expect(applyEntryEvent(current, "entry:deleted", { entryId: "e1", entryStatus: "open" }, options)!.historyChanged).toBe(false);
    });

    it("cannot judge a delete event without the entry status and asks for a refetch", () => {
      const current = [entry({ id: "e1", status: "done" })];

      expect(applyEntryEvent(current, "entry:deleted", { entryId: "e1" }, options)).toBeNull();
    });
  });

  describe("payloads that cannot be applied", () => {
    it.each([
      ["entry:created", { entryId: "e1" }],
      ["entry:updated", { entryId: "e1", entry: null }],
      ["entry:updated", { entryId: "e1", entry: "nope" }],
      ["entry:updated", { entryId: "e1", entry: { text: "no id" } }],
      ["entry:updated", { entryId: "e1", entry: { id: "other", status: "open", text: "wrong id" } }],
      ["entry:deleted", {}],
      ["entry:deleted", { entryId: "e1" }],
      ["entry:deleted", { entryId: "e1", entryStatus: "weird" }]
    ] as const)("returns null for %s with %j so the caller refetches", (type, data) => {
      expect(applyEntryEvent([entry({ id: "e1" })], type, data as Record<string, unknown>, options)).toBeNull();
    });
  });
});

describe("sortEntries", () => {
  it("orders open entries before done ones and by creation time within a status", () => {
    const sorted = sortEntries([
      entry({ id: "d", status: "done", created_at: "2026-04-01T08:00:00.000Z" }),
      entry({ id: "b", created_at: "2026-04-01T12:00:00.000Z" }),
      entry({ id: "a", created_at: "2026-04-01T09:00:00.000Z" })
    ]);

    expect(sorted.map((candidate) => candidate.id)).toEqual(["a", "b", "d"]);
  });
});
