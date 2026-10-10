import { lazy } from "react";

// The info & settings sheet is opened rarely, so it is fetched on first use (see DeferredSheet).
export const InfoSheet = lazy(() => import("../../components/InfoSheet/InfoSheet"));
