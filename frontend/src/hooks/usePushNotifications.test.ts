import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchVapidPublicKey,
  subscribePush,
  unsubscribePush
} from "../api/push";
import { usePushNotifications } from "./usePushNotifications";

vi.mock("../api/push", () => ({
  fetchVapidPublicKey: vi.fn(),
  subscribePush: vi.fn(),
  unsubscribePush: vi.fn()
}));

const fetchVapidPublicKeyMock = vi.mocked(fetchVapidPublicKey);
const subscribePushMock = vi.mocked(subscribePush);
const unsubscribePushMock = vi.mocked(unsubscribePush);

interface HookHarnessProps {
  enabled?: boolean;
  token?: string;
}

interface TestPushSubscription extends PushSubscriptionJSON {
  unsubscribe?: () => Promise<boolean>;
  toJSON: () => PushSubscriptionJSON;
}

function HookHarness({ enabled = true, token = "token-1" }: HookHarnessProps) {
  const { isReady, isSubscribed, isSupported, subscribe, unsubscribe } = usePushNotifications({
    enabled,
    token
  });
  const [subscribeError, setSubscribeError] = useState("");
  const [subscribeResult, setSubscribeResult] = useState("");

  return [
    createElement("span", { "data-testid": "supported", key: "supported" }, String(isSupported)),
    createElement("span", { "data-testid": "ready", key: "ready" }, String(isReady)),
    createElement("span", { "data-testid": "subscribed", key: "subscribed" }, String(isSubscribed)),
    createElement("span", { "data-testid": "subscribe-error", key: "subscribe-error" }, subscribeError),
    createElement(
      "span",
      { "data-testid": "subscribe-result", key: "subscribe-result" },
      subscribeResult
    ),
    createElement(
      "button",
      {
        key: "subscribe",
        onClick: async () => {
          try {
            setSubscribeError("");
            setSubscribeResult(String(await subscribe()));
          } catch (error) {
            setSubscribeResult("");
            setSubscribeError(error instanceof Error ? error.message : String(error));
          }
        },
        type: "button"
      },
      "subscribe"
    ),
    createElement(
      "button",
      { key: "unsubscribe", onClick: () => void unsubscribe(), type: "button" },
      "unsubscribe"
    )
  ];
}

function createDeferred<T = unknown>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe("usePushNotifications", () => {
  let subscribeResult: TestPushSubscription;
  let unsubscribeResult: boolean;

  beforeEach(() => {
    fetchVapidPublicKeyMock.mockReset();
    subscribePushMock.mockReset();
    unsubscribePushMock.mockReset();

    subscribeResult = {
      endpoint: "https://push.example.com/subscriptions/1",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key"
      },
      toJSON(): PushSubscriptionJSON {
        return {
          endpoint: subscribeResult.endpoint,
          keys: subscribeResult.keys
        };
      }
    };
    unsubscribeResult = true;

    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(async () => "granted")
    });
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            async getSubscription() {
              return null;
            },
            async subscribe() {
              return subscribeResult;
            }
          }
        })
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("loads the VAPID key only when enabled and subscribes the browser endpoint", async () => {
    fetchVapidPublicKeyMock.mockResolvedValue({ publicKey: "dGVzdA" });

    render(createElement(HookHarness, { enabled: true }));

    expect((await screen.findByTestId("supported")).textContent).toBe("true");
    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });

    await act(async () => {
      screen.getByText("subscribe").click();
    });

    expect(fetchVapidPublicKey).toHaveBeenCalledTimes(1);
    expect(subscribePush).toHaveBeenCalledWith("token-1", {
      endpoint: "https://push.example.com/subscriptions/1",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key"
      }
    });
    expect(screen.getByTestId("subscribed").textContent).toBe("true");
  });

  it("returns false without requesting permission when the VAPID key is still loading", async () => {
    const deferredKey = createDeferred<Awaited<ReturnType<typeof fetchVapidPublicKey>>>();
    fetchVapidPublicKeyMock.mockReturnValue(deferredKey.promise);

    render(createElement(HookHarness, { enabled: true }));

    expect(screen.getByTestId("ready").textContent).toBe("false");

    await act(async () => {
      screen.getByText("subscribe").click();
    });

    expect(window.Notification.requestPermission!).not.toHaveBeenCalled();
    expect(subscribePush).not.toHaveBeenCalled();

    deferredKey.resolve({ publicKey: "dGVzdA" });
    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });
  });

  it("reports readiness only after the VAPID key finishes loading", async () => {
    const deferredKey = createDeferred<Awaited<ReturnType<typeof fetchVapidPublicKey>>>();
    fetchVapidPublicKeyMock.mockReturnValue(deferredKey.promise);

    render(createElement(HookHarness, { enabled: true }));

    expect(screen.getByTestId("supported").textContent).toBe("true");
    expect(screen.getByTestId("ready").textContent).toBe("false");

    deferredKey.resolve({ publicKey: "dGVzdA" });

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });
  });

  it("becomes ready when the VAPID key loads even while serviceWorker.ready is pending", async () => {
    fetchVapidPublicKeyMock.mockResolvedValue({ publicKey: "dGVzdA" });
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: new Promise(() => {})
      }
    });

    render(createElement(HookHarness, { enabled: true }));

    expect(screen.getByTestId("ready").textContent).toBe("false");

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });

    expect(subscribePush).not.toHaveBeenCalled();
  });

  it("subscribes without re-reading serviceWorker.ready once the registration is cached", async () => {
    fetchVapidPublicKeyMock.mockResolvedValue({ publicKey: "dGVzdA" });
    let readyAccessCount = 0;
    const registration = {
      pushManager: {
        async getSubscription() {
          return null;
        },
        async subscribe() {
          return subscribeResult;
        }
      }
    };

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {}
    });
    Object.defineProperty(window.navigator.serviceWorker, "ready", {
      configurable: true,
      get() {
        readyAccessCount += 1;
        return Promise.resolve(registration);
      }
    });

    render(createElement(HookHarness, { enabled: true }));

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });
    expect(readyAccessCount).toBe(1);

    await act(async () => {
      screen.getByText("subscribe").click();
    });

    expect(screen.getByTestId("subscribe-result").textContent).toBe("true");
    expect(screen.getByTestId("subscribed").textContent).toBe("true");
    expect(readyAccessCount).toBe(1);
  });

  it("rejects subscribe with a timeout error when no service worker registration becomes available", async () => {
    fetchVapidPublicKeyMock.mockResolvedValue({ publicKey: "dGVzdA" });
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: new Promise(() => {})
      }
    });

    render(createElement(HookHarness, { enabled: true }));

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });

    vi.useFakeTimers();

    await act(async () => {
      screen.getByText("subscribe").click();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(screen.getByTestId("subscribe-error").textContent).toBe(
      "Service worker is not available. Try refreshing the page."
    );
    expect(subscribePush).not.toHaveBeenCalled();
  });

  it("does not fetch the VAPID key when the toggle is disabled", () => {
    render(createElement(HookHarness, { enabled: false }));

    expect(fetchVapidPublicKey).not.toHaveBeenCalled();
    expect(screen.getByTestId("supported").textContent).toBe("false");
  });

  it("unsubscribes the active endpoint and updates local state", async () => {
    fetchVapidPublicKeyMock.mockResolvedValue({ publicKey: "dGVzdA" });

    subscribeResult = {
      endpoint: "https://push.example.com/subscriptions/1",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key"
      },
      async unsubscribe() {
        return unsubscribeResult;
      },
      toJSON(): PushSubscriptionJSON {
        return {
          endpoint: subscribeResult.endpoint,
          keys: subscribeResult.keys
        };
      }
    };

    render(createElement(HookHarness, { enabled: true }));

    await waitFor(() => {
      expect(screen.getByTestId("ready").textContent).toBe("true");
    });

    await act(async () => {
      screen.getByText("subscribe").click();
    });

    await act(async () => {
      screen.getByText("unsubscribe").click();
    });

    expect(unsubscribePush).toHaveBeenCalledWith(
      "token-1",
      "https://push.example.com/subscriptions/1"
    );
    expect(screen.getByTestId("subscribed").textContent).toBe("false");
  });
});
