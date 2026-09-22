import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { OFFLINE_SYNC_COMPLETE_EVENT } from "../api/client";
import { listOfflineMutations, OFFLINE_QUEUE_CHANGED_EVENT, removeOfflineMutation } from "../api/offlineStore";
import { drainOfflineQueue } from "../api/offlineQueueDrain";
import type { AcceptedMutations } from "../api/offlineQueueDrain";
import { createTimeoutSignal, REQUEST_TIMEOUT_MS, QUEUE_RETRY_BASE_DELAY_MS, QUEUE_RETRY_MAX_DELAY_MS, QUEUE_DRAIN_STALL_TIMEOUT_MS } from "../api/connectionTimings";
import type { OfflineQueueContextValue } from "../types";
import { OfflineQueueContext } from "./offlineQueueContextValue";
import { ensureFreshState, getIsOnline, subscribe } from "../api/connectivity";
import type { ReachabilityTimings } from "../api/connectivity";

interface QueueTimings extends ReachabilityTimings {
  REQUEST_TIMEOUT_MS?: number;
  QUEUE_RETRY_BASE_DELAY_MS?: number;
  QUEUE_RETRY_MAX_DELAY_MS?: number;
  QUEUE_DRAIN_STALL_TIMEOUT_MS?: number;
}
interface OfflineQueueProviderProps {
  children: ReactNode;
  timings?: QueueTimings;
}

export function OfflineQueueProvider({ children, timings }: OfflineQueueProviderProps): ReactElement {
  const [isOffline, setIsOffline] = useState(() => getIsOnline() === false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncVersion, setSyncVersion] = useState(0);
  const [failedMutationId, setFailedMutationId] = useState("");
  const blockedRef = useRef("");
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const activeRun = useRef<ReturnType<typeof createTimeoutSignal> | null>(null);
  const accepted = useRef<AcceptedMutations>(new Map());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryAttempt = useRef(0);
  const retryAction = useRef<() => Promise<void>>(async () => {});
  const requestTimeout = timings?.REQUEST_TIMEOUT_MS ?? REQUEST_TIMEOUT_MS;
  const retryBase = timings?.QUEUE_RETRY_BASE_DELAY_MS ?? QUEUE_RETRY_BASE_DELAY_MS;
  const retryMax = timings?.QUEUE_RETRY_MAX_DELAY_MS ?? QUEUE_RETRY_MAX_DELAY_MS;
  const stallTimeout = timings?.QUEUE_DRAIN_STALL_TIMEOUT_MS ?? QUEUE_DRAIN_STALL_TIMEOUT_MS;
  const probeTimeout = timings?.REACHABILITY_PROBE_TIMEOUT_MS;
  const probeInterval = timings?.REACHABILITY_PROBE_MIN_INTERVAL_MS;
  const probeTimings = useMemo(() => ({ REACHABILITY_PROBE_TIMEOUT_MS: probeTimeout, REACHABILITY_PROBE_MIN_INTERVAL_MS: probeInterval }), [probeTimeout, probeInterval]);

  const refreshQueuedCount = useCallback(async (): Promise<void> => {
    const pending = await listOfflineMutations();
    if (mountedRef.current) setQueuedCount(pending.length);
  }, []);

  const cancelRetry = useCallback(() => {
    clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
  }, []);

  const scheduleRetry = useCallback(() => {
    if (!mountedRef.current || blockedRef.current || retryTimer.current !== undefined) return;
    // Failed probes count as attempts too; keep retrying without requiring another browser event.
    const delay = Math.min(retryBase * 2 ** retryAttempt.current, retryMax);
    retryAttempt.current = Math.min(retryAttempt.current + 1, 32);
    retryTimer.current = setTimeout(() => {
      retryTimer.current = undefined;
      void retryAction.current();
    }, delay);
  }, [retryBase, retryMax]);

  const drainQueue = useCallback(async (): Promise<void> => {
    if (activeRun.current || blockedRef.current || !mountedRef.current) return;
    cancelRetry();
    // The stall deadline aborts the current fetch before releasing ownership to a replacement run.
    const run = createTimeoutSignal(stallTimeout);
    activeRun.current = run;
    setIsSyncing(true);
    let retry = false;
    try {
      const result = await drainOfflineQueue(run.signal, requestTimeout, accepted.current);
      if (activeRun.current !== run) return;
      if (result.failed) {
        blockedRef.current = result.failed.id;
        setFailedMutationId(result.failed.id);
        setSyncError(result.failed.error);
      } else {
        retryAttempt.current = 0;
        setSyncError("");
        if (result.count > 0) {
          setSyncVersion((version) => version + 1);
          window.dispatchEvent(new Event(OFFLINE_SYNC_COMPLETE_EVENT));
        }
      }
    } catch {
      retry = true;
    } finally {
      run.cancel();
      if (activeRun.current === run) {
        activeRun.current = null;
        setIsSyncing(false);
        if (retry) scheduleRetry();
        void refreshQueuedCount();
      }
    }
  }, [cancelRetry, requestTimeout, stallTimeout, scheduleRetry, refreshQueuedCount]);

  const checkAndDrain = useCallback(async (): Promise<void> => {
    if (!mountedRef.current || activeRun.current || blockedRef.current) return;
    const generation = generationRef.current;
    // A real request or live stream already establishes reachability. Only queue work
    // needs an explicit probe, avoiding a health request on every empty-queue startup.
    const pending = await listOfflineMutations();
    if (!mountedRef.current || generation !== generationRef.current || activeRun.current || blockedRef.current) return;
    if (pending.length === 0 && getIsOnline() !== false) return;
    const online = await ensureFreshState(probeTimings);
    if (!mountedRef.current || generation !== generationRef.current) return;
    if (online) await drainQueue();
    else {
      const pending = await listOfflineMutations();
      if (generation === generationRef.current && pending.length > 0) scheduleRetry();
    }
  }, [drainQueue, probeTimings, scheduleRetry]);

  const discardFailedMutation = useCallback(async (): Promise<void> => {
    if (!blockedRef.current) return;
    await removeOfflineMutation(blockedRef.current);
    blockedRef.current = "";
    setFailedMutationId("");
    setSyncError("");
    void checkAndDrain();
  }, [checkAndDrain]);

  useEffect(() => {
    mountedRef.current = true;
    generationRef.current += 1;
    retryAction.current = checkAndDrain;
    setIsSyncing(false);
    void refreshQueuedCount();
    let previousOnline = getIsOnline();
    const unsubscribe = subscribe(() => {
      const online = getIsOnline();
      // Only confirmed reachability changes the banner; browser events just request a check.
      setIsOffline(online === false);
      const recovered = online === true && previousOnline !== true;
      previousOnline = online;
      if (recovered) void checkAndDrain();
    });
    function handleWake(): void { void checkAndDrain(); }
    function handleQueueChanged(): void {
      void refreshQueuedCount();
      void checkAndDrain();
    }
    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") void checkAndDrain();
    }
    window.addEventListener("online", handleWake);
    window.addEventListener("offline", handleWake);
    window.addEventListener("pageshow", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkAndDrain();
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      cancelRetry();
      const run = activeRun.current;
      activeRun.current = null;
      run?.abort();
      run?.cancel();
      unsubscribe();
      window.removeEventListener("online", handleWake);
      window.removeEventListener("offline", handleWake);
      window.removeEventListener("pageshow", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [cancelRetry, checkAndDrain, refreshQueuedCount]);

  return (
    <OfflineQueueContext.Provider value={{ isOffline, queuedCount, isSyncing, syncError, syncVersion, failedMutationId, discardFailedMutation } satisfies OfflineQueueContextValue}>
      {children}
    </OfflineQueueContext.Provider>
  );
}
