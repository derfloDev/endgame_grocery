import { describe, expect, it } from "vitest";
import { sortLists } from "./overviewSort";

const lists = [
  {
    id: "list-b",
    name: "Bananas",
    created_at: "2026-02-01T00:00:00.000Z",
    last_activity: "2026-04-01T00:00:00.000Z"
  },
  {
    id: "list-a",
    name: "Apples",
    created_at: "2026-01-01T00:00:00.000Z",
    last_activity: "2026-03-01T00:00:00.000Z"
  },
  {
    id: "list-c",
    name: "Carrots"
  }
];

describe("sortLists", () => {
  it("sorts lists by creation date oldest first with missing dates last", () => {
    expect(sortLists(lists, "created_asc").map((list) => list.id)).toEqual([
      "list-a",
      "list-b",
      "list-c"
    ]);
  });

  it("sorts lists by name", () => {
    expect(sortLists(lists, "name_asc").map((list) => list.id)).toEqual([
      "list-a",
      "list-b",
      "list-c"
    ]);
  });

  it("sorts lists by latest activity with missing dates last", () => {
    expect(sortLists(lists, "activity_desc").map((list) => list.id)).toEqual([
      "list-b",
      "list-a",
      "list-c"
    ]);
  });
});
