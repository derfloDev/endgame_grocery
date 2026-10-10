import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEntriesCacheKey } from "../../api/entries";
import { LISTS_CACHE_KEY, createListCacheKey } from "../../api/lists";
import { createMembersCacheKey } from "../../api/sharing";
import { SSE_EVENTS, SSE_EVENT_TYPES } from "../../api/sseEvents";

const srcDir = path.resolve(import.meta.dirname, "../..");

function sourceFiles(directory = srcDir): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);

    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }

    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

const relative = (file: string) => path.relative(srcDir, file).replaceAll("\\", "/");

describe("cache keys are spelled out once", () => {
  it("builds the keys the offline cache has always used", () => {
    expect(createEntriesCacheKey("list-1")).toBe("entries:list-1");
    expect(createMembersCacheKey("list-1")).toBe("members:list-1");
    expect(createListCacheKey("list-1")).toBe("list:list-1");
    expect(LISTS_CACHE_KEY).toBe("lists");
  });

  it("has no entries:/members: key literal outside the api helpers", () => {
    const offenders = sourceFiles()
      .filter((file) => !relative(file).startsWith("api/"))
      .filter((file) => /[`"'](entries|members):/.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});

describe("SSE event names are declared once", () => {
  it("matches the event names the backend sends", () => {
    expect(SSE_EVENTS).toEqual({
      entryCreated: "entry:created",
      entryUpdated: "entry:updated",
      entryDeleted: "entry:deleted",
      historyUpdated: "history:updated",
      listUpdated: "list:updated",
      listDeleted: "list:deleted",
      memberAdded: "member:added",
      memberRemoved: "member:removed"
    });
  });

  it("lists every event exactly once for the stream subscription", () => {
    expect([...SSE_EVENT_TYPES].sort()).toEqual(Object.values(SSE_EVENTS).sort());
    expect(new Set(SSE_EVENT_TYPES).size).toBe(SSE_EVENT_TYPES.length);
  });

  it("has no event name string outside api/sseEvents.ts", () => {
    const names = Object.values(SSE_EVENTS).map((name) => `["']${name}["']`).join("|");
    const pattern = new RegExp(names);
    const offenders = sourceFiles()
      .filter((file) => relative(file) !== "api/sseEvents.ts")
      .filter((file) => pattern.test(readFileSync(file, "utf8")))
      .map(relative);

    expect(offenders).toEqual([]);
  });
});
