import { describe, expect, it } from "vitest";
import { mergePendingEntries } from "./listDetailUtils";
import type { DetailEntry } from "./useListDetailData";

describe("mergePendingEntries", () => {
  const server: DetailEntry = { id: "entry-1", text: "Milk", status: "open" };
  const pending: DetailEntry = { id: "temp-entry-1", text: "Bread", status: "open", is_pending_sync: true };

  it("retains unknown pending entries with their pending flag and details", () => {
    const local = { ...pending, details: "Whole wheat", icon: "IconBread" };
    expect(mergePendingEntries([server], [local])).toEqual([server, local]);
  });

  it("uses the server version when a pending id is now present on the server", () => {
    expect(mergePendingEntries([server], [{ ...server, text: "Old name", is_pending_sync: true }])).toEqual([server]);
  });

  it("drops missing entries that are no longer pending", () => {
    expect(mergePendingEntries([], [server, pending])).toEqual([pending]);
  });

  it("preserves server order followed by local pending order without mutating inputs", () => {
    const anotherServer = { ...server, id: "entry-2" };
    const anotherPending = { ...pending, id: "temp-entry-2" };
    const serverEntries = [anotherServer, server];
    const localEntries = [anotherPending, server, pending];
    expect(mergePendingEntries(serverEntries, localEntries)).toEqual([anotherServer, server, anotherPending, pending]);
    expect(serverEntries).toEqual([anotherServer, server]);
    expect(localEntries).toEqual([anotherPending, server, pending]);
  });
});
