import { lazy } from "react";

// Sheets are opened rarely, so each one is its own chunk, fetched on first use (see DeferredSheet).
export const AddItemSheet = lazy(() => import("../../components/AddItemSheet/AddItemSheet"));
export const ListOptionsSheet = lazy(() => import("../../components/ListOptionsSheet/ListOptionsSheet"));
export const RenameListSheet = lazy(() => import("../../components/RenameListSheet/RenameListSheet"));
export const ShareListSheet = lazy(() => import("../../components/ShareListSheet/ShareListSheet"));
