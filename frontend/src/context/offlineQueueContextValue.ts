import { createContext } from "react";
import type { OfflineQueueContextValue } from "../types";

export const OfflineQueueContext = createContext<OfflineQueueContextValue | null>(null);
