import { render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSourceProvider, useEventSource } from "./EventSourceContext";
import { useAuth } from "./AuthContext";

vi.mock("./AuthContext", () => ({
  useAuth: vi.fn()
}));

describe("EventSourceProvider", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens an EventSource when a token is present", async () => {
    useAuth.mockReturnValue({ token: "token-123" });

    render(
      <EventSourceProvider>
        <div>child</div>
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    expect(MockEventSource.instances[0].url).toBe("/api/events?token=token-123");
  });

  it("closes the active EventSource when the token is removed", async () => {
    useAuth.mockReturnValue({ token: "token-123" });

    const rendered = render(
      <EventSourceProvider>
        <div>child</div>
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const eventSource = MockEventSource.instances[0];
    useAuth.mockReturnValue({ token: "" });

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

    useAuth.mockReturnValue({ token: "token-123" });

    render(
      <EventSourceProvider>
        <ListenerHarness eventType="entry:created" handler={handler} />
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("entry:created", {
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

    useAuth.mockReturnValue({ token: "token-123" });

    const rendered = render(
      <EventSourceProvider>
        <ListenerHarness eventType="entry:created" handler={handler} />
      </EventSourceProvider>
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    rendered.unmount();
    MockEventSource.instances[0].emit("entry:created", {
      listId: "list-1",
      entryId: "entry-1"
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

function ListenerHarness({ eventType, handler }) {
  const { addEventListener } = useEventSource();

  useEffect(() => addEventListener(eventType, handler), [addEventListener, eventType, handler]);

  return null;
}

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockEventSource.OPEN;
    this.listeners = new Map();
    this.close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type, data) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({
        data: JSON.stringify(data)
      });
    }
  }
}
