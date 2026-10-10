import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Entry, List, Member, MutationResult, QueuedMutationResult } from "../types";
import { sendJsonRequest } from "./client";
import { createEntry, fetchEntries, updateEntry } from "./entries";
import { createList, fetchList, fetchLists, renameList } from "./lists";
import { fetchListMembers } from "./sharing";

// The assertions on types are checked by `npm run typecheck` (tsc includes test files); vitest only
// executes the runtime part.

describe("domain types match the API", () => {
  it("entries carry nullable details like the API returns them", () => {
    expectTypeOf<Entry["details"]>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<Entry["status"]>().toEqualTypeOf<"open" | "done">();
  });

  it("members use the API field names", () => {
    expectTypeOf<Member>().toHaveProperty("user_id").toEqualTypeOf<string>();
    expectTypeOf<Member>().toHaveProperty("display_name").toEqualTypeOf<string>();
    expectTypeOf<Member>().toHaveProperty("email").toEqualTypeOf<string>();
    expectTypeOf<Member["is_owner"]>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<Member["joined_at"]>().toEqualTypeOf<string | undefined>();
  });

  it("lists expose their owner", () => {
    expectTypeOf<List["owner_id"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<List["owner_name"]>().toEqualTypeOf<string | undefined>();
  });

  it("does not re-declare Detail* types next to the shared ones", () => {
    const sourceFiles: string[] = [];
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const full = path.join(directory, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && name !== "apiTypes.test.ts") sourceFiles.push(full);
      }
    };
    walk(path.resolve(import.meta.dirname, ".."));

    const offenders = sourceFiles.filter((file) => /\bDetail(Entry|List|Member)\b/.test(readFileSync(file, "utf8")));

    expect(offenders.map((file) => path.relative(path.resolve(import.meta.dirname, ".."), file))).toEqual([]);
  });
});

describe("request helper types", () => {
  it("sendJsonRequest resolves to the type the caller states", () => {
    expectTypeOf(sendJsonRequest<{ ok: boolean }>).returns.resolves.toEqualTypeOf<{ ok: boolean }>();
    expectTypeOf(sendJsonRequest).returns.resolves.toEqualTypeOf<unknown>();
  });

  it("reads resolve to their response shapes without casts", () => {
    expectTypeOf(fetchEntries).returns.resolves.toHaveProperty("entries").toEqualTypeOf<Entry[]>();
    expectTypeOf(fetchLists).returns.resolves.toHaveProperty("lists").toEqualTypeOf<List[]>();
    expectTypeOf(fetchList).returns.resolves.toHaveProperty("list").toEqualTypeOf<List>();
    expectTypeOf(fetchListMembers).returns.resolves.toHaveProperty("members").toEqualTypeOf<Member[]>();
  });

  it("mutations are a union of the queued marker and the server's answer", () => {
    expectTypeOf(createEntry).returns.resolves.toEqualTypeOf<MutationResult<{ entry: Entry }>>();
    expectTypeOf(updateEntry).returns.resolves.toEqualTypeOf<MutationResult<{ entry: Entry }>>();
    expectTypeOf(createList).returns.resolves.toEqualTypeOf<MutationResult<{ list: List }>>();
    expectTypeOf(renameList).returns.resolves.toEqualTypeOf<MutationResult<{ list: List }>>();
  });

  it("narrows a mutation result on `queued`", () => {
    const describeResult = (result: MutationResult<{ entry: Entry }>): string => {
      if (result.queued) {
        expectTypeOf(result).toEqualTypeOf<QueuedMutationResult>();
        return "queued";
      }

      expectTypeOf(result.entry).toEqualTypeOf<Entry>();
      return result.entry.text;
    };

    expect(describeResult({ queued: true })).toBe("queued");
    expect(describeResult({ entry: { id: "e1", text: "Milk", status: "open" } })).toBe("Milk");
    expect(describeResult({ queued: false, entry: { id: "e1", text: "Bread", status: "open" } })).toBe("Bread");
  });
});
