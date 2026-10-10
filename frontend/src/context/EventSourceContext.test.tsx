import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSourceProvider, useEventSource } from "./EventSourceContext";
import { useAuth } from "./AuthContext";
import type { SseEventType, SseHandler } from "./EventSourceContext";
import { AuthExpiredError } from "../api/client";
import { getIsOnline, resetConnectivityForTests } from "../api/connectivity";
import { fetchEventTicket } from "../api/events";

vi.mock("./AuthContext", () => ({
  useAuth: vi.fn()
}));

// The stream URL carries a single-use ticket requested over an authenticated call.
vi.mock("../api/events", () => ({
  fetchEventTicket: vi.fn()
}));

const useAuthMock = vi.mocked(useAuth);
const fetchEventTicketMock = vi.mocked(fetchEventTicket);

describe("EventSourceProvider", () => {
  beforeEach(() => {
    fetchEventTicketMock.mockReset();
    fetchEventTicketMock.mockResolvedValue("ticket-abc");
    MockEventSource.instances = [];
    resetConnectivityForTests();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("opens an EventSource when a token is present", async () => {
    useAuthMock.mockReturnValue(createAuthValue("token-123"));

    render(
      <EventSourceProvider>
        <div>child</div>
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    expect(MockEventSource.instances[0]?.url).toBe("/api/events?ticket=ticket-abc");
    expect(fetchEventTicketMock).toHaveBeenCalledWith("token-123");
  });

  it("closes the active EventSource when the token is removed", async () => {
    useAuthMock.mockReturnValue(createAuthValue("token-123"));

    const rendered = render(
      <EventSourceProvider>
        <div>child</div>
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const eventSource = MockEventSource.instances[0]!;
    useAuthMock.mockReturnValue(createAuthValue(""));

    rendered.rerender(
      <EventSourceProvider>
        <div>child</div>
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(eventSource.close).toHaveBeenCalledTimes(1);
    });
  });

  it("delivers incoming events to registered handlers", async () => {
    const handler = vi.fn();

    useAuthMock.mockReturnValue(createAuthValue("token-123"));

    render(
      <EventSourceProvider>
        <ListenerHarness eventType="entry:created" handler={handler} />
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0]?.emit("entry:created", {
      listId: "list-1",
      entryId: "entry-1"
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith({
        listId: "list-1",
        entryId: "entry-1"
      });
    });
  });

  it("stops calling handlers after listener cleanup", async () => {
    const handler = vi.fn();

    useAuthMock.mockReturnValue(createAuthValue("token-123"));

    const rendered = render(
      <EventSourceProvider>
        <ListenerHarness eventType="entry:created" handler={handler} />
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    rendered.unmount();
    MockEventSource.instances[0]?.emit("entry:created", {
      listId: "list-1",
      entryId: "entry-1"
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("EventSource reconnect manager", () => {
  const timings = {
    SSE_RECONNECT_BASE_DELAY_MS: 100,
    SSE_RECONNECT_MAX_DELAY_MS: 400,
    SSE_RECONNECT_JITTER_RATIO: 0.3,
    SSE_HEARTBEAT_TIMEOUT_MS: 1000,
    RESYNC_DEDUPE_WINDOW_MS: 200
  };

  beforeEach(() => {
    fetchEventTicketMock.mockReset();
    fetchEventTicketMock.mockResolvedValue("ticket-abc");
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.stubGlobal("EventSource", MockEventSource);
    MockEventSource.instances = [];
    resetConnectivityForTests();
    useAuthMock.mockReturnValue(createAuthValue("token-123"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // The stream URL needs a ticket from an async request, so every step that can open a stream
  // flushes pending promises.
  async function flush() {
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
  }

  async function mount() {
    const view = render(<EventSourceProvider timings={timings}><StateHarness /></EventSourceProvider>);
    await flush();
    return view;
  }

  async function advance(ms: number) {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  }

  function latest() {
    return MockEventSource.instances[MockEventSource.instances.length - 1]!;
  }

  async function wake(type: "visible" | "hidden" | "online") {
    await act(async () => {
      if (type === "online") {
        window.dispatchEvent(new Event("online"));
      } else {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue(type);
        document.dispatchEvent(new Event("visibilitychange"));
      }
    });
    await flush();
  }

  function resyncVersion() {
    return Number.parseInt(screen.getByTestId("resync-version").textContent ?? "", 10);
  }

  it("does not resync on the first successful connection, even after initial failures", async () => {
    await mount();
    expect(resyncVersion()).toBe(0);
    act(() => { latest().fail(); });
    await advance(100);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(0);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(0);
  });

  it.each([MockEventSource.CLOSED, MockEventSource.CONNECTING])("resyncs on a confirmed reconnect after loss in state %s", async (state) => {
    await mount();
    act(() => { latest().open(); latest().fail(state); });
    expect(resyncVersion()).toBe(0);
    if (state === MockEventSource.CLOSED) await advance(100);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(1);
    await advance(200);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(1);
  });

  it("resyncs only on hidden-to-visible transitions with a healthy stream", async () => {
    await mount();
    act(() => { latest().open(); });
    await wake("visible");
    await wake("online");
    expect(resyncVersion()).toBe(0);
    await wake("hidden");
    expect(resyncVersion()).toBe(0);
    await wake("visible");
    expect(resyncVersion()).toBe(1);
    await advance(200);
    await wake("visible");
    expect(resyncVersion()).toBe(1);
    await wake("hidden");
    await wake("visible");
    expect(resyncVersion()).toBe(2);
  });

  it("deduplicates reconnect followed by foreground within the configured window", async () => {
    await mount();
    act(() => { latest().open(); });
    await wake("hidden");
    act(() => { latest().fail(); });
    await advance(100);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(1);
    await advance(199);
    await wake("visible");
    expect(resyncVersion()).toBe(1);
    await advance(1);
    await wake("hidden");
    await wake("visible");
    expect(resyncVersion()).toBe(2);
  });

  it("deduplicates foreground followed by a reconnect", async () => {
    await mount();
    act(() => { latest().open(); });
    await wake("hidden");
    await wake("visible");
    act(() => { latest().fail(MockEventSource.CONNECTING); latest().open(); });
    expect(resyncVersion()).toBe(1);
  });

  it("waits for the unhealthy foreground stream to reopen before resyncing", async () => {
    await mount();
    act(() => { latest().open(); });
    await wake("hidden");
    vi.setSystemTime(Date.now() + 1001);
    await wake("visible");
    expect(resyncVersion()).toBe(0);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(1);
  });

  it("resyncs after watchdog recovery", async () => {
    await mount();
    act(() => { latest().open(); });
    await advance(1100);
    act(() => { latest().open(); });
    expect(resyncVersion()).toBe(1);
  });

  it("creates no stream or timer without a token, including on wake-up", async () => {
    useAuthMock.mockReturnValue(createAuthValue(""));
    await mount();
    await wake("visible");
    await wake("online");
    expect(MockEventSource.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByTestId("connection-state").textContent).toBe("closed");
  });

  it("reports connecting, open and closed and preserves the listener registration function", async () => {
    const values: ReturnType<typeof useEventSource>[] = [];
    function Consumer() {
      values.push(useEventSource());
      return null;
    }
    const view = render(<EventSourceProvider timings={timings}><Consumer /></EventSourceProvider>);
    expect(values.at(-1)?.connectionState).toBe("connecting");
    await flush();
    act(() => { latest().open(); });
    expect(values.at(-1)?.connectionState).toBe("open");
    expect(getIsOnline()).toBe(true);
    const openValue = values.at(-1);
    view.rerender(<EventSourceProvider timings={{ ...timings }}><Consumer /></EventSourceProvider>);
    expect(values.at(-1)).toBe(openValue);
    expect(MockEventSource.instances).toHaveLength(1);
    act(() => { latest().fail(); });
    expect(values.at(-1)?.connectionState).toBe("closed");
    expect(new Set(values.map((value) => value.addEventListener)).size).toBe(1);
  });

  it("creates no timer when EventSource is unavailable", async () => {
    vi.stubGlobal("EventSource", undefined);
    await mount();
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.getByTestId("connection-state").textContent).toBe("closed");
  });

  it("uses a 45 second watchdog and a one second initial retry by default", async () => {
    render(<EventSourceProvider><StateHarness /></EventSourceProvider>);
    await flush();
    const source = latest();
    act(() => { source.open(); });
    await advance(44_999);
    expect(source.close).not.toHaveBeenCalled();
    await advance(1);
    expect(source.close).toHaveBeenCalledTimes(1);
    await advance(999);
    expect(MockEventSource.instances).toHaveLength(1);
    await advance(1);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("preserves subscriptions across reconnect and ignores callbacks queued by the old stream", async () => {
    const handler = vi.fn();
    render(<EventSourceProvider timings={timings}><ListenerHarness eventType="entry:created" handler={handler} /></EventSourceProvider>);
    await flush();
    const source = latest();
    const staleError = source.onerror;
    const staleTraffic = [...source.listeners.get("entry:created")!][0];
    act(() => { source.fail(); staleError?.(new Event("error")); });
    await advance(100);
    act(() => {
      latest().open();
      staleTraffic(new MessageEvent("entry:created", { data: '{"entryId":"old"}' }));
      latest().emit("entry:created", { entryId: "new" });
    });
    expect(handler).toHaveBeenCalledExactlyOnceWith({ entryId: "new" });
    expect(vi.getTimerCount()).toBe(1);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("retries closed streams with increasing delay capped at the maximum", async () => {
    await mount();
    for (const delay of [100, 200, 400, 400, 400]) {
      const source = latest();
      const count = MockEventSource.instances.length;
      act(() => { source.fail(); });
      expect(source.close).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(1);
      await advance(delay - 1);
      expect(MockEventSource.instances).toHaveLength(count);
      await advance(1);
      expect(MockEventSource.instances).toHaveLength(count + 1);
    }
  });

  it.each([[0, 70], [1, 130]])("jitters retry delays for random value %s", async (random, delay) => {
    vi.mocked(Math.random).mockReturnValue(random);
    await mount();
    act(() => { latest().fail(); });
    await advance(delay - 1);
    expect(MockEventSource.instances).toHaveLength(1);
    await advance(1);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it("caps the final delay even with positive jitter", async () => {
    vi.mocked(Math.random).mockReturnValue(1);
    await mount();
    for (const delay of [130, 260, 400, 400]) {
      const count = MockEventSource.instances.length;
      act(() => { latest().fail(); });
      await advance(delay - 1);
      expect(MockEventSource.instances).toHaveLength(count);
      await advance(1);
      expect(MockEventSource.instances).toHaveLength(count + 1);
    }
  });

  it("resets backoff only after the stream opens", async () => {
    await mount();
    act(() => { latest().fail(); });
    await advance(100);
    act(() => { latest().fail(); });
    await advance(200);
    act(() => { latest().open(); latest().fail(); });
    await advance(99);
    expect(MockEventSource.instances).toHaveLength(3);
    await advance(1);
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it("reconnects silent streams after the watchdog expires without an error", async () => {
    await mount();
    const source = latest();
    act(() => { source.open(); });
    await advance(999);
    expect(source.close).not.toHaveBeenCalled();
    await advance(1);
    expect(source.close).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("connection-state").textContent).toBe("closed");
    await advance(100);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it.each(["ping", "message", "entry:created", "history:updated"])("re-arms the watchdog on %s traffic", async (type) => {
    await mount();
    const source = latest();
    act(() => { source.open(); });
    await advance(900);
    act(() => { source.emit(type, {}); });
    await advance(999);
    expect(source.close).not.toHaveBeenCalled();
    await advance(1);
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it("re-arms the watchdog on open and lets native retry recover CONNECTING streams", async () => {
    await mount();
    const source = latest();
    act(() => { source.open(); });
    await advance(600);
    act(() => { source.fail(MockEventSource.CONNECTING); });
    expect(screen.getByTestId("connection-state").textContent).toBe("connecting");
    await advance(300);
    expect(MockEventSource.instances).toHaveLength(1);
    act(() => { source.open(); });
    await advance(999);
    expect(source.close).not.toHaveBeenCalled();
    await advance(1);
    expect(source.close).toHaveBeenCalledTimes(1);
  });

  it("does not extend the watchdog on repeated native retry errors", async () => {
    await mount();
    const source = latest();
    await advance(600);
    act(() => { source.fail(MockEventSource.CONNECTING); });
    await advance(300);
    act(() => { source.fail(MockEventSource.CONNECTING); });
    await advance(100);
    expect(source.close).toHaveBeenCalledTimes(1);
    await advance(100);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it.each(["visible", "online"] as const)("reconnects immediately on %s when unhealthy and cancels backoff", async (type) => {
    await mount();
    act(() => { latest().fail(); });
    await wake(type);
    expect(MockEventSource.instances).toHaveLength(2);
    act(() => { latest().open(); });
    await advance(400);
    expect(MockEventSource.instances).toHaveLength(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("leaves a healthy stream alone on wake-up and ignores hidden transitions", async () => {
    await mount();
    act(() => { latest().open(); });
    await wake("visible");
    await wake("online");
    expect(MockEventSource.instances).toHaveLength(1);
    act(() => { latest().fail(); });
    await wake("hidden");
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("replaces a stale OPEN stream on foreground return before throttled timers fire", async () => {
    await mount();
    const source = latest();
    act(() => { source.open(); });
    vi.setSystemTime(Date.now() + 1001);
    await wake("visible");
    expect(source.close).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(2);
  });

  it.each(["unmount", "logout"])("clears pending retry and lifecycle listeners on %s", async (action) => {
    const view = await mount();
    const source = latest();
    const staleError = source.onerror;
    const staleOpen = source.onopen;
    act(() => { source.fail(); });
    if (action === "unmount") {
      view.unmount();
    } else {
      useAuthMock.mockReturnValue(createAuthValue(""));
      view.rerender(<EventSourceProvider timings={timings}><StateHarness /></EventSourceProvider>);
      expect(screen.getByTestId("connection-state").textContent).toBe("closed");
    }
    act(() => { staleError?.(new Event("error")); staleOpen?.(new Event("open")); });
    await wake("visible");
    await wake("online");
    expect(vi.getTimerCount()).toBe(0);
    await advance(10000);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it.each(["unmount", "logout"])("closes an active stream and clears its watchdog on %s", async (action) => {
    const view = await mount();
    const source = latest();
    act(() => { source.open(); });
    if (action === "unmount") {
      view.unmount();
    } else {
      useAuthMock.mockReturnValue(createAuthValue(""));
      view.rerender(<EventSourceProvider timings={timings}><StateHarness /></EventSourceProvider>);
    }
    expect(source.close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(source.onopen).toBeNull();
    expect(source.onerror).toBeNull();
    expect([...source.listeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
  });

  it("replaces the old token stream and ignores its queued callbacks", async () => {
    const view = await mount();
    const source = latest();
    const staleOpen = source.onopen;
    const staleError = source.onerror;
    fetchEventTicketMock.mockResolvedValueOnce("ticket-for-new-token");
    useAuthMock.mockReturnValue(createAuthValue("new/token"));
    view.rerender(<EventSourceProvider timings={timings}><StateHarness /></EventSourceProvider>);
    expect(source.close).toHaveBeenCalledTimes(1);
    await flush();
    expect(fetchEventTicketMock).toHaveBeenLastCalledWith("new/token");
    expect(latest().url).toBe("/api/events?ticket=ticket-for-new-token");
    act(() => { staleOpen?.(new Event("open")); staleError?.(new Event("error")); });
    expect(screen.getByTestId("connection-state").textContent).toBe("connecting");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("keeps only one live stream and watchdog through StrictMode setup and cleanup", async () => {
    const view = render(<StrictMode><EventSourceProvider timings={timings}><StateHarness /></EventSourceProvider></StrictMode>);
    await flush();
    // The first setup is cleaned up before its ticket arrives, so it never opens a stream.
    expect(MockEventSource.instances).toHaveLength(1);
    expect(latest().close).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("opens the stream with a ticket and never puts the JWT in the URL", async () => {
    await mount();
    expect(fetchEventTicketMock).toHaveBeenCalledExactlyOnceWith("token-123");
    expect(latest().url).toBe("/api/events?ticket=ticket-abc");
    expect(latest().url).not.toContain("token-123");
  });

  it("requests a fresh ticket for every reconnect", async () => {
    fetchEventTicketMock.mockResolvedValueOnce("ticket-1").mockResolvedValueOnce("ticket-2");
    await mount();
    act(() => { latest().fail(); });
    await advance(100);
    expect(MockEventSource.instances.map((instance) => instance.url)).toEqual([
      "/api/events?ticket=ticket-1",
      "/api/events?ticket=ticket-2"
    ]);
  });

  it("treats a failed ticket request as a failed attempt and retries with backoff", async () => {
    fetchEventTicketMock.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
    await mount();
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.getByTestId("connection-state").textContent).toBe("closed");
    await advance(99);
    expect(fetchEventTicketMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchEventTicketMock).toHaveBeenCalledTimes(2);
    expect(MockEventSource.instances).toHaveLength(0);
    // The second failure doubles the delay (100 -> 200) like a failed stream would.
    await advance(199);
    expect(fetchEventTicketMock).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(fetchEventTicketMock).toHaveBeenCalledTimes(3);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("does not retry when the ticket request reports an expired session", async () => {
    fetchEventTicketMock.mockRejectedValue(new AuthExpiredError());
    await mount();
    await advance(10_000);
    expect(fetchEventTicketMock).toHaveBeenCalledTimes(1);
    expect(MockEventSource.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a ticket that arrives after unmount or after a newer connect attempt", async () => {
    let resolveTicket!: (ticket: string) => void;
    fetchEventTicketMock.mockReturnValueOnce(new Promise<string>((resolve) => { resolveTicket = resolve; }));
    const view = await mount();
    view.unmount();
    await act(async () => { resolveTicket("late-ticket"); });
    expect(MockEventSource.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not request a ticket without a token", async () => {
    useAuthMock.mockReturnValue(createAuthValue(""));
    await mount();
    expect(fetchEventTicketMock).not.toHaveBeenCalled();
  });
});

function StateHarness() {
  const { connectionState, resyncVersion } = useEventSource();
  return <><span data-testid="connection-state">{connectionState}</span><span data-testid="resync-version">{resyncVersion}</span></>;
}

interface ListenerHarnessProps {
  eventType: SseEventType;
  handler: SseHandler;
}

function ListenerHarness({ eventType, handler }: ListenerHarnessProps) {
  const { addEventListener } = useEventSource();

  useEffect(() => addEventListener(eventType, handler), [addEventListener, eventType, handler]);

  return null;
}

function createAuthValue(token: string): ReturnType<typeof useAuth> {
  return {
    token,
    user: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    setAuthToken: vi.fn()
  };
}

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  url: string;
  readyState: number;
  listeners: Map<string, Set<(event: MessageEvent<string>) => void>>;
  close: ReturnType<typeof vi.fn>;
  onerror: ((event: Event) => void) | null;
  onopen: ((event: Event) => void) | null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.CONNECTING;
    this.listeners = new Map();
    this.close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });
    this.onerror = null;
    this.onopen = null;
    MockEventSource.instances.push(this);
  }

  open() {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.(new Event("open"));
  }

  fail(state = MockEventSource.CLOSED) {
    this.readyState = state;
    this.onerror?.(new Event("error"));
  }

  addEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)?.add(handler);
  }

  removeEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, data: Record<string, unknown>) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }
}
