import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockWorker {
  static instances: MockWorker[] = [];

  url: string | URL;
  options?: WorkerOptions;
  listeners: Map<string, (event: Event | MessageEvent) => void>;
  postMessage: ReturnType<typeof vi.fn>;

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    this.listeners = new Map();
    this.postMessage = vi.fn();
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, handler: (event: Event | MessageEvent) => void) {
    this.listeners.set(type, handler);
  }

  dispatch(type: string, event: Event | MessageEvent = new Event(type)) {
    const handler = this.listeners.get(type);

    if (handler) {
      handler(event);
    }
  }
}

describe("iconWorkerClient", () => {
  beforeEach(() => {
    MockWorker.instances = [];
    vi.stubGlobal("Worker", MockWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("primes the shared worker with an init message", async () => {
    const { primeIconWorker } = await import("./iconWorkerClient");

    primeIconWorker();

    const worker = MockWorker.instances[0];

    expect(worker).toBeInstanceOf(MockWorker);
    expect(worker?.options).toEqual({ type: "module" });
    expect(worker?.postMessage).toHaveBeenCalledWith({ type: "init" });
  });

  it("rejects pending matches and recreates the worker after an error", async () => {
    const { requestIconMatch } = await import("./iconWorkerClient");
    const firstRequest = requestIconMatch("Gemuese");
    const firstWorker = MockWorker.instances[0];

    expect(firstWorker?.postMessage).toHaveBeenCalledWith({
      type: "match",
      id: 0,
      text: "Gemuese"
    });

    firstWorker?.dispatch("error");

    await expect(firstRequest).rejects.toThrow("Icon worker failed.");

    const secondRequest = requestIconMatch("Gemuese");
    const secondWorker = MockWorker.instances[1];

    expect(secondWorker).toBeInstanceOf(MockWorker);
    expect(secondWorker).not.toBe(firstWorker);

    expect(secondWorker?.postMessage).toHaveBeenCalledWith({
      type: "match",
      id: 1,
      text: "Gemuese"
    });

    secondWorker?.dispatch("message", new MessageEvent("message", {
      data: {
        type: "matchResult",
        id: 1,
        iconName: "IconCarrot",
        score: 0.74,
        topMatches: [{ iconName: "IconCarrot", score: 0.74 }]
      }
    }));

    await expect(secondRequest).resolves.toEqual({
      iconName: "IconCarrot",
      score: 0.74,
      topMatches: [{ iconName: "IconCarrot", score: 0.74 }]
    });
  });
});
