// Grocery domain

export interface Entry {
  id: string;
  text: string;
  icon?: string | null;
  details?: string;
  status: "open" | "done";
  is_pending_sync?: boolean;
}

export interface List {
  id: string;
  name?: string;
  is_owner?: boolean;
}

export interface Member {
  id: string;
  email?: string;
  display_name?: string;
}

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
  token: string;
  createdAt: string;
  queueMeta?: QueueMeta | null;
}

export interface OfflineQueueContextValue {
  isOffline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  syncError: string;
  syncVersion: number;
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
