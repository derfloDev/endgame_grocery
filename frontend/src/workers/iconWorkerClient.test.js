import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockWorker {
  static instances = [];

  constructor(url, options) {
    this.url = url;
    this.options = options;
    this.listeners = new Map();
    this.postMessage = vi.fn();
    MockWorker.instances.push(this);
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  dispatch(type, event = {}) {
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
    const { getIconWorker, primeIconWorker } = await import("./iconWorkerClient");

    primeIconWorker();

    const worker = getIconWorker();

    expect(worker).toBeInstanceOf(MockWorker);
    expect(worker.options).toEqual({ type: "module" });
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "init" });
  });

  it("rejects pending matches and recreates the worker after an error", async () => {
    const { getIconWorker, requestIconMatch } = await import("./iconWorkerClient");
    const firstWorker = getIconWorker();
    const firstRequest = requestIconMatch("Gemuese");

    expect(firstWorker.postMessage).toHaveBeenCalledWith({
      type: "match",
      id: 0,
      text: "Gemuese"
    });

    firstWorker.dispatch("error");

    await expect(firstRequest).rejects.toThrow("Icon worker failed.");

    const secondWorker = getIconWorker();

    expect(secondWorker).toBeInstanceOf(MockWorker);
    expect(secondWorker).not.toBe(firstWorker);

    const secondRequest = requestIconMatch("Gemuese");

    expect(secondWorker.postMessage).toHaveBeenCalledWith({
      type: "match",
      id: 1,
      text: "Gemuese"
    });

    secondWorker.dispatch("message", {
      data: {
        type: "matchResult",
        id: 1,
        iconName: "IconCarrot",
        score: 0.74,
        topMatches: [{ iconName: "IconCarrot", score: 0.74 }]
      }
    });

    await expect(secondRequest).resolves.toEqual({
      iconName: "IconCarrot",
      score: 0.74,
      topMatches: [{ iconName: "IconCarrot", score: 0.74 }]
    });
  });
});
