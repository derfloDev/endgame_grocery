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

  it("marks the active bottom navigation tab from the current route", () => {
    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/search"]}
      >
        <BottomNav />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Search" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Lists" }).getAttribute("aria-current")).toBeNull();
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
});
