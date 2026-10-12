import { useEffect, useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";

export interface ServiceWorkerUpdateState {
  dismissUpdate: () => void;
  needRefresh: boolean;
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
}

// One plugin-owned registration serves both updates and push. A failed attempt can be
// replaced by a deliberate retry; never unregister a worker or discard offline caches.
let registrationAttempt: Promise<ServiceWorkerRegistration> | null = null;
let updateWorker: (reloadPage?: boolean) => Promise<void> = async () => undefined;
let needRefresh = false;
const listeners = new Set<() => void>();
function setNeedRefresh(value: boolean): void {
  needRefresh = value;
  listeners.forEach(listener => listener());
}
function startRegistration(): Promise<ServiceWorkerRegistration> {
  if (registrationAttempt) return registrationAttempt;
  registrationAttempt = new Promise((resolve, reject) => {
    updateWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisteredSW: (_url, registration) => {
        if (registration) resolve(registration);
        else reject(new Error("workerRegistration"));
      },
      onRegisterError: () => reject(new Error("workerRegistration"))
    });
  });
  const attempt = registrationAttempt;
  void attempt.catch(() => { if (registrationAttempt === attempt) registrationAttempt = null; });
  return attempt;
}

// Registration success does not imply installation success. Observe the actual worker,
// including redundant installs, and release every timer/listener on success, failure or abort.
export function ensureServiceWorker(signal?: AbortSignal): Promise<ServiceWorkerRegistration> {
  const attempt = startRegistration();
  return new Promise((resolve, reject) => {
    let settled = false;
    let registration: ServiceWorkerRegistration | undefined;
    const workers = new Set<ServiceWorker>();
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      registration?.removeEventListener("updatefound", inspect);
      workers.forEach(worker => worker.removeEventListener("statechange", inspect));
      if (error) reject(error);
      else resolve(registration!);
    };
    const abort = (): void => finish(new DOMException("Aborted", "AbortError"));
    const inspect = (): void => {
      if (settled || !registration) return;
      if (registration.active?.state === "activated") { finish(); return; }
      for (const worker of [registration.installing, registration.waiting, registration.active]) {
        if (!worker || workers.has(worker)) continue;
        workers.add(worker);
        worker.addEventListener("statechange", inspect);
      }
      if ([...workers].some(worker => worker.state === "redundant")) {
        if (registrationAttempt === attempt) registrationAttempt = null;
        finish(new Error("workerInstallation"));
      }
    };
    const timer = window.setTimeout(() => {
      if (registrationAttempt === attempt) registrationAttempt = null;
      finish(new Error("workerTimeout"));
    }, 8000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    void attempt.then(value => {
      if (settled) return;
      registration = value;
      registration.addEventListener?.("updatefound", inspect);
      inspect();
    }, error => finish(error));
  });
}

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const refresh = useSyncExternalStore(callback => {
    listeners.add(callback);
    return () => { listeners.delete(callback); };
  }, () => needRefresh);
  useEffect(() => { void startRegistration().catch(() => undefined); }, []);
  return {
    dismissUpdate: () => setNeedRefresh(false),
    needRefresh: import.meta.env.DEV ? false : refresh,
    updateServiceWorker: reloadPage => updateWorker(reloadPage)
  };
}
