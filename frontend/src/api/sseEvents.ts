/**
 * Names of the server-sent events, declared once. The backend sends exactly these strings
 * (`backend/src/sseManager.js` callers); the stream provider, the list hooks and the pages refer to
 * them through this object so a typo cannot silently stop an event from arriving.
 */
export const SSE_EVENTS = {
  entryCreated: "entry:created",
  entryUpdated: "entry:updated",
  entryDeleted: "entry:deleted",
  historyUpdated: "history:updated",
  listUpdated: "list:updated",
  listDeleted: "list:deleted",
  memberAdded: "member:added",
  memberRemoved: "member:removed"
} as const;

export type SseEventType = (typeof SSE_EVENTS)[keyof typeof SSE_EVENTS];

/** Every event the app subscribes to on the shared stream. */
export const SSE_EVENT_TYPES: readonly SseEventType[] = Object.values(SSE_EVENTS);

/** The entry events carry an entry (or its id and status) that clients patch into their state. */
export type EntrySseEventType = typeof SSE_EVENTS.entryCreated | typeof SSE_EVENTS.entryUpdated | typeof SSE_EVENTS.entryDeleted;
