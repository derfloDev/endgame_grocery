import { createElement } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useListEvents } from "./useListEvents";
import { useEventSource } from "../context/EventSourceContext";

vi.mock("../context/EventSourceContext", () => ({
  useEventSource: vi.fn()
}));

describe("useListEvents", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calls the handler when the event matches the active list", async () => {
    const subscriptions = createEventSourceMock();
    const handler = vi.fn();

    useEventSource.mockReturnValue({
      addEventListener: subscriptions.addEventListener
    });

    render(createElement(HookHarness, { eventType: "entry:created", listId: "list-1", handler }));

    subscriptions.emit("entry:created", { listId: "list-1", entryId: "entry-1" });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith({
        listId: "list-1",
        entryId: "entry-1"
      });
    });
  });

  it("does not call the handler when the event belongs to another list", async () => {
    const subscriptions = createEventSourceMock();
    const handler = vi.fn();

    useEventSource.mockReturnValue({
      addEventListener: subscriptions.addEventListener
    });

    render(createElement(HookHarness, { eventType: "entry:created", listId: "list-1", handler }));
    subscriptions.emit("entry:created", { listId: "list-2", entryId: "entry-1" });

    await waitFor(() => {
      expect(handler).not.toHaveBeenCalled();
    });
  });

  it("forwards all events when listId is null", async () => {
    const subscriptions = createEventSourceMock();
    const handler = vi.fn();

    useEventSource.mockReturnValue({
      addEventListener: subscriptions.addEventListener
    });

    render(createElement(HookHarness, { eventType: "list:deleted", listId: null, handler }));
    subscriptions.emit("list:deleted", { listId: "list-9" });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledWith({ listId: "list-9" });
    });
  });

  it("removes the listener on unmount", async () => {
    const subscriptions = createEventSourceMock();
    const handler = vi.fn();

    useEventSource.mockReturnValue({
      addEventListener: subscriptions.addEventListener
    });

    const rendered = render(
      createElement(HookHarness, {
        eventType: "member:removed",
        listId: "list-1",
        handler
      })
    );

    rendered.unmount();
    subscriptions.emit("member:removed", { listId: "list-1", userId: "user-2" });

    await waitFor(() => {
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

function HookHarness({ eventType, listId, handler }) {
  useListEvents(eventType, listId, handler);
  return null;
}

function createEventSourceMock() {
  const handlers = new Map();

  return {
    addEventListener(type, handler) {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }

      handlers.get(type).add(handler);

      return () => {
        handlers.get(type)?.delete(handler);
      };
    },
    emit(type, data) {
      for (const handler of handlers.get(type) ?? []) {
        handler(data);
      }
    }
  };
}
