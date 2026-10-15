// Grocery domain

export interface Entry {
  id: string;
  text: string;
  icon?: string | null;
  /** The API returns `null` for an entry without details. */
  details?: string | null;
  status: "open" | "done";
  created_at?: string;
  updated_at?: string;
  last_updated_by?: string | null;
  is_changed?: boolean;
  is_pending_sync?: boolean;
}

export interface List {
  id: string;
  name?: string;
  owner_id?: string;
  owner_name?: string;
  is_owner?: boolean;
  changed_count?: number;
  created_at?: string;
  last_activity?: string;
  /** Set on lists created offline that are still waiting to sync. */
  is_pending_sync?: boolean;
}

/** A list member as `GET /api/lists/:id/members` returns it. */
export interface Member {
  user_id: string;
  display_name: string;
  email: string;
  joined_at?: string;
  is_owner?: boolean;
  is_pending_sync?: boolean;
}

/** Answer of a mutation that could not reach the server and was put into the offline queue. */
export interface QueuedMutationResult {
  queued: true;
}

/**
 * Result of a write request: either the offline queue accepted it (`queued: true`, no server data
 * yet) or the server answered with `T`. Narrow with `if (result.queued)`.
 */
export type MutationResult<T> = QueuedMutationResult | (T & { queued?: false });

export interface User {
  id: string;
  display_name?: string;
  email?: string;
}

// App config

export interface AppConfig {
  registrationEnabled: boolean;
}

// Offline queue

export interface QueueMeta {
  resourceType?: string;
  tempId?: string;
}

export interface OfflineMutation {
  id: string;
  url: string;
  method: string;
  payload?: unknown;
  /**
   * The user who queued the change. Only that user's session replays it, with the token that is
   * valid at drain time (tokens are no longer stored with the mutation).
   */
  userId?: string;
  /** @deprecated Only present on mutations queued by older versions; never used. */
  token?: string;
  createdAt: string;
  queueMeta?: QueueMeta | null;
  // Accepted creates leave mappings on pending mutations so retries survive a page reload.
  resolvedIds?: Record<string, string>;
}

export interface OfflineQueueContextValue {
  isOffline: boolean;
  /** The network is available but edge access needs recovery; queued work is preserved. */
  isReauthRequired: boolean;
  queuedCount: number;
  isSyncing: boolean;
  syncError: string;
  /** i18n key that explains `syncError` in the user's language; empty when the server's text is shown. */
  syncErrorKey: string;
  syncVersion: number;
  /** Temporary ids that received a real id during this session (temp id -> real id). */
  resolvedIds: Record<string, string>;
  failedMutationId: string;
  discardFailedMutation: () => Promise<void>;
}

// Autocomplete and suggestions

export interface Suggestion {
  text: string;
  icon?: string | null;
  details?: string;
  useCount?: number;
}

// Icon worker

interface TopMatch {
  iconName: string;
  score: number;
}

export interface IconMatchResult {
  iconName: string | null;
  score: number;
  topMatches: TopMatch[];
}

// Icon registry

/** Minimum prop contract shared by every icon component in ICON_REGISTRY. */
export interface IconProps {
  size?: number;
  stroke?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean | "true";
  "data-icon-name"?: string;
  "data-testid"?: string;
}
