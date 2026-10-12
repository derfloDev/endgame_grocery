import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "../api/push";
import { ensureServiceWorker } from "../sw/register";
import { usePushNotifications } from "./usePushNotifications";

vi.mock("../api/push", () => ({ fetchVapidPublicKey: vi.fn(), subscribePush: vi.fn(), unsubscribePush: vi.fn() }));
vi.mock("../sw/register", () => ({ ensureServiceWorker: vi.fn() }));
const subscription = { endpoint: "https://push.example/1", toJSON: () => ({ endpoint: "https://push.example/1" }), unsubscribe: vi.fn(async () => true) };
const registration = { pushManager: { getSubscription: vi.fn(async (): Promise<typeof subscription | null> => null), subscribe: vi.fn(async () => subscription) } };
const options = { enabled: true, token: "token-1" };
const mount = () => renderHook(() => usePushNotifications(options));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn(async () => "granted") });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
  vi.mocked(fetchVapidPublicKey).mockResolvedValue({ publicKey: "dGVzdA" });
  vi.mocked(ensureServiceWorker).mockResolvedValue(registration as unknown as ServiceWorkerRegistration);
  registration.pushManager.getSubscription.mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

 describe("push lifecycle", () => {
  it("restores an existing subscription after key loading, including StrictMode", async () => {
    registration.pushManager.getSubscription.mockResolvedValue(subscription);
    const { result } = renderHook(() => usePushNotifications(options), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
  it("keeps retry available after registration failure and clears feedback after recovery", async () => {
    vi.mocked(ensureServiceWorker).mockRejectedValue(new Error("workerRegistration"));
    const { result } = mount();
    await waitFor(() => expect(result.current.error).toBe("workerRegistration"));
    expect(result.current.isReady).toBe(true);
    vi.mocked(ensureServiceWorker).mockResolvedValue(registration as unknown as ServiceWorkerRegistration);
    await act(async () => { expect(await result.current.subscribe()).toBe(true); });
    expect(result.current.error).toBe(null);
    expect(result.current.isPending).toBe(false);
    expect(subscribePush).toHaveBeenCalledWith("token-1", subscription.toJSON());
  });
  it("settles timeout feedback and allows another attempt", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    vi.mocked(ensureServiceWorker).mockRejectedValueOnce(new Error("workerTimeout"));
    await act(async () => { expect(await result.current.subscribe()).toBe(false); });
    expect(result.current.error).toBe("workerTimeout");
    await act(async () => { expect(await result.current.subscribe()).toBe(true); });
  });
  it("prevents duplicate attempts while permission is pending", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    Object.defineProperty(Notification, "permission", { value: "default", configurable: true });
    let resolve!: (permission: NotificationPermission) => void;
    vi.mocked(Notification.requestPermission).mockReturnValue(new Promise(r => { resolve = r; }));
    let first!: Promise<boolean>;
    await act(async () => { first = result.current.subscribe(); expect(await result.current.subscribe()).toBe(false); });
    expect(result.current.isPending).toBe(true);
    await act(async () => { resolve("granted"); await first; });
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(registration.pushManager.subscribe).toHaveBeenCalledTimes(1);
  });
  it("does not prompt denied permission again", async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    Object.defineProperty(Notification, "permission", { value: "denied", configurable: true });
    await act(async () => { expect(await result.current.subscribe()).toBe(false); });
    expect(result.current.error).toBe("permissionDenied");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
  it("distinguishes missing configuration and supports refetch after failure", async () => {
    vi.mocked(fetchVapidPublicKey).mockResolvedValueOnce({ publicKey: "" });
    const { result } = mount();
    await waitFor(() => expect(result.current.error).toBe("configuration"));
    await act(async () => { expect(await result.current.subscribe()).toBe(true); });
  });
  it("detects unsupported PushManager without loading configuration", () => {
    vi.stubGlobal("PushManager", undefined);
    const { result } = mount();
    expect(result.current.isSupported).toBe(false);
    expect(fetchVapidPublicKey).not.toHaveBeenCalled();
  });
  it("reuses browser subscriptions and preserves unsubscribe", async () => {
    registration.pushManager.getSubscription.mockResolvedValue(subscription);
    const { result } = mount();
    await waitFor(() => expect(result.current.isSubscribed).toBe(true));
    await act(async () => { await result.current.subscribe(); });
    expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.unsubscribe()).toBe(true); });
    expect(unsubscribePush).toHaveBeenCalledWith("token-1", subscription.endpoint);
    expect(result.current.isSubscribed).toBe(false);
  });
  it("does not replace successful recovery with a late background failure", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(ensureServiceWorker).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const { result } = mount();
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await act(async () => { expect(await result.current.subscribe()).toBe(true); });
    await act(async () => { reject(new Error("workerTimeout")); });
    expect(result.current.error).toBe(null);
    expect(result.current.isSubscribed).toBe(true);
  });
  it("does not load or prompt while disabled or configuration is still loading", async () => {
    const disabled = renderHook(() => usePushNotifications({ enabled: false, token: "token-1" }));
    expect(fetchVapidPublicKey).not.toHaveBeenCalled();
    disabled.unmount();
    vi.mocked(fetchVapidPublicKey).mockReturnValueOnce(new Promise(() => undefined));
    const { result } = mount();
    await act(async () => { expect(await result.current.subscribe()).toBe(false); });
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
  it("ignores stale initialization after token changes or unmount", async () => {
    let resolve!: (value: { publicKey: string }) => void;
    vi.mocked(fetchVapidPublicKey).mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const { result, rerender, unmount } = renderHook(({ token }) => usePushNotifications({ enabled: true, token }), { initialProps: { token: "old" } });
    rerender({ token: "new" });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    unmount();
    await act(async () => { resolve({ publicKey: "old" }); });
  });
});
