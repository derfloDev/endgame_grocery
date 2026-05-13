import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BottomSheet,
  EmptyState,
  ErrorState,
  FAB,
  Icon,
  LoadingState,
  TopBar
} from ".";

const uiDir = import.meta.dirname;
const indexSource = readFileSync(path.resolve(uiDir, "index.ts"), "utf8");

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

  it("applies custom and browser-open classes to the bottom sheet container", () => {
    render(
      <BottomSheet browserOpen className="custom-sheet" open title="Add Item" onClose={() => {}}>
        <p>Milk</p>
      </BottomSheet>
    );

    const className = screen.getByRole("dialog", { name: "Add Item" }).className;

    expect(className).toContain("custom-sheet");
    expect(className.split(" ").length).toBeGreaterThanOrEqual(3);
  });

  it("exports UI primitives from their component folders", () => {
    const componentFiles = [
      "BottomSheet/BottomSheet.tsx",
      "EmptyState/EmptyState.tsx",
      "ErrorState/ErrorState.tsx",
      "FAB/FAB.tsx",
      "Icon/Icon.tsx",
      "LoadingState/LoadingState.tsx",
      "TopBar/TopBar.tsx"
    ];

    for (const fileName of componentFiles) {
      expect(existsSync(path.resolve(uiDir, fileName))).toBe(true);
    }

    expect(indexSource).toContain('export { default as BottomSheet } from "./BottomSheet/BottomSheet";');
    expect(indexSource).toContain('export { default as Icon } from "./Icon/Icon";');
    expect(indexSource).not.toContain('from "./BottomSheet";');
  });
});
