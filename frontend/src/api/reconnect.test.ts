import { afterEach, describe, expect, it, vi } from "vitest";
import { buildReconnectUrl, reconnect, RECONNECT_PARAM, stripReconnectParam } from "./reconnect";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); history.replaceState(null, "", "/"); });
describe("reconnect navigation", () => {
  it("keeps the path, query and hash and replaces the reserved parameter", () => {
    const url = new URL(buildReconnectUrl(new URL("https://grocery.example/lists/one?filter=open&__reconnect=old#item"), 123));
    expect(RECONNECT_PARAM).toBe("__reconnect");
    expect(url.pathname).toBe("/lists/one");
    expect(url.searchParams.get("filter")).toBe("open");
    expect(url.searchParams.getAll(RECONNECT_PARAM)).toEqual(["123"]);
    expect(url.hash).toBe("#item");
  });
  it("assigns a top-level navigation using the current location and timestamp", () => {
    const assign = vi.fn();
    vi.spyOn(Date, "now").mockReturnValue(456);
    vi.stubGlobal("window", { location: { href: "https://grocery.example/lists/one?q=milk#item", assign } });
    reconnect();
    expect(assign).toHaveBeenCalledExactlyOnceWith("https://grocery.example/lists/one?q=milk&__reconnect=456#item");
  });
  it("strips all reserved parameters and preserves history state, other queries and hash", () => {
    history.replaceState({ marker: 7 }, "", "/lists/one?filter=open&__reconnect=1&__reconnect=2#item");
    const replace = vi.spyOn(history, "replaceState");
    stripReconnectParam();
    expect(location.pathname + location.search + location.hash).toBe("/lists/one?filter=open#item");
    expect(history.state).toEqual({ marker: 7 });
    expect(replace).toHaveBeenCalledTimes(1);
    stripReconnectParam();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
