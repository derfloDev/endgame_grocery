import type { IconMatchResult } from "../types";

type PendingIconRequest = {
  resolve: (value: IconMatchResult) => void;
  reject: (error: Error) => void;
};
type IconWorkerResponse = Partial<IconMatchResult> & {
  type?: "ready" | "matchResult" | "matchError";
  id?: number;
  error?: string;
};

let iconWorker: Worker | null | undefined;
let nextRequestId = 0;
const pendingRequests = new Map<number, PendingIconRequest>();

const emptyIconMatchResult: IconMatchResult = { iconName: null, score: 0, topMatches: [] };

function rejectPendingRequests(error: Error): void {
  for (const { reject } of pendingRequests.values()) {
    reject(error);
  }

  pendingRequests.clear();
}

function handleWorkerMessage(event: MessageEvent<IconWorkerResponse>): void {
  const { type, id, iconName = null, score = 0, topMatches = [], error } = event.data ?? {};

  if (typeof id !== "number") {
    return;
  }

  if (type === "matchResult") {
    const pendingRequest = pendingRequests.get(id);

    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(id);
    pendingRequest.resolve({ iconName, score, topMatches });
    return;
  }

  if (type === "matchError") {
    const pendingRequest = pendingRequests.get(id);

    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(id);
    pendingRequest.reject(new Error(error ?? "Icon worker matching failed."));
  }
}

function handleWorkerError(): void {
  rejectPendingRequests(new Error("Icon worker failed."));
  // Drop the crashed instance so the next request can bootstrap a fresh worker.
  iconWorker = null;
}

function createIconWorker(): Worker | null {
  if (typeof Worker === "undefined") {
    return null;
  }

  const worker = new Worker(new URL("./iconWorker.ts", import.meta.url), {
    type: "module"
  });

  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", handleWorkerError);

  return worker;
}

function getIconWorker(): Worker | null {
  if (iconWorker == null) {
    iconWorker = createIconWorker();
  }

  return iconWorker;
}

export function primeIconWorker(): void {
  const worker = getIconWorker();

  if (!worker) {
    return;
  }

  worker.postMessage({ type: "init" });
}

export function requestIconMatch(text: string): Promise<IconMatchResult> {
  const worker = getIconWorker();

  if (!worker) {
    return Promise.resolve(emptyIconMatchResult);
  }

  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ type: "match", id, text });
  });
}
