import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import ListOptionsSheet from "./ListOptionsSheet";

describe("ListOptionsSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows only the leave action for non-owners", async () => {
    const onLeaveSelect = vi.fn();

    render(
      <ListOptionsSheet
        isOwner={false}
        open
        onClose={vi.fn()}
        onLeaveSelect={onLeaveSelect}
      />
    );

    expect(screen.queryByRole("button", { name: /Rename list/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Share list/ })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /Leave list/ }));

    expect(onLeaveSelect).toHaveBeenCalledOnce();
  });
});
