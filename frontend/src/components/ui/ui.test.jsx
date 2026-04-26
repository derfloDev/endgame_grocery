import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BottomNav,
  BottomSheet,
  EmptyState,
  ErrorState,
  FAB,
  Icon,
  LoadingState,
  TopBar
} from ".";

describe("shared Endgame UI components", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all shared UI components without errors", () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/lists/list-1"]}
      >
        <Icon name="sparkles" />
        <TopBar title="Weekly groceries" subtitle="4 open" onBack={() => {}} actions={[{ icon: "share", onClick: () => {} }]} />
        <FAB onClick={() => {}} />
        <BottomNav />
        <EmptyState title="No lists yet" body="Create your first mission." action="Create" onAction={() => {}} />
        <LoadingState rows={3} />
        <ErrorState onRetry={() => {}} />
        <BottomSheet open title="New List" onClose={() => {}}>
          <p>Sheet content</p>
        </BottomSheet>
      </MemoryRouter>
    );

    expect(screen.getByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByText("No lists yet")).toBeTruthy();
    expect(screen.getByText("Mission Failed")).toBeTruthy();
    expect(screen.getByText("New List")).toBeTruthy();
    expect(screen.getByText("Sheet content")).toBeTruthy();
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  it("renders a single Lists bottom navigation tab and marks it active on list routes", () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/lists/list-1"]}
      >
        <BottomNav />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Lists" }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
  });

  it("closes the bottom sheet from the backdrop and does not render when closed", async () => {
    const onClose = vi.fn();

    const { rerender } = render(
      <BottomSheet open title="Add Item" onClose={onClose}>
        <p>Milk</p>
      </BottomSheet>
    );

    await userEvent.click(screen.getByLabelText("Close sheet"));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <BottomSheet open={false} title="Add Item" onClose={onClose}>
        <p>Milk</p>
      </BottomSheet>
    );

    expect(screen.queryByText("Add Item")).toBeNull();
  });

  it("forwards custom class names to the bottom sheet container", () => {
    render(
      <BottomSheet className="bottom-sheet--browser-open" open title="Add Item" onClose={() => {}}>
        <p>Milk</p>
      </BottomSheet>
    );

    expect(screen.getByRole("dialog", { name: "Add Item" }).className).toContain("bottom-sheet--browser-open");
  });
});
