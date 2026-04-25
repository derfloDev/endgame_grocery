let iconWorker;
let nextRequestId = 0;
const pendingRequests = new Map();

function rejectPendingRequests(error) {
  for (const { reject } of pendingRequests.values()) {
    reject(error);
  }

  pendingRequests.clear();
}

function handleWorkerMessage(event) {
  const { type, id, icon = null, score = 0, error } = event.data ?? {};

  if (type === "matchResult") {
    const pendingRequest = pendingRequests.get(id);

    if (!pendingRequest) {
      return;
    }

    pendingRequests.delete(id);
    pendingRequest.resolve({ icon, score });
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

function handleWorkerError() {
  rejectPendingRequests(new Error("Icon worker failed."));
}

function createIconWorker() {
  if (typeof Worker === "undefined") {
    return null;
  }

  const worker = new Worker(new URL("./iconWorker.js", import.meta.url), {
    type: "module"
  });

  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", handleWorkerError);

  return worker;
}

export function getIconWorker() {
  if (iconWorker === undefined) {
    iconWorker = createIconWorker();
  }

  return iconWorker;
}

export function primeIconWorker() {
  const worker = getIconWorker();

  if (!worker) {
    return;
  }

  worker.postMessage({ type: "init" });
}

export function requestIconMatch(text) {
  const worker = getIconWorker();

  if (!worker) {
    return Promise.resolve({ icon: null, score: 0 });
  }

  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ type: "match", id, text });
  });
}
