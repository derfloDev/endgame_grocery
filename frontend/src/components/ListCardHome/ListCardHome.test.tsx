import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../../i18n";
import ListCardHome from "./ListCardHome";

describe("ListCardHome", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a changed count badge when a shared list has unseen changes", () => {
    render(
      <ListCardHome
        list={{
          id: "list-1",
          name: "Weekly groceries",
          is_owner: false,
          owner_name: "Alex",
          changed_count: 3
        }}
      />
    );

    expect(screen.getByText("3").className).toContain("list-card-change-badge");
  });

  it("omits the changed count badge when there are no unseen changes", () => {
    render(
      <ListCardHome
        list={{
          id: "list-1",
          name: "Weekly groceries",
          is_owner: true,
          changed_count: 0
        }}
      />
    );

    expect(screen.queryByText("0")).toBeNull();
  });
});
