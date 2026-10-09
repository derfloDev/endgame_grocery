import { lazy } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeferredSheet from "./DeferredSheet";

function createLazySheet() {
  const load = vi.fn(async () => ({ default: () => <div>Sheet content</div> }));
  const LazySheet = lazy(load);

  return { LazySheet, load };
}

describe("DeferredSheet", () => {
  afterEach(cleanup);

  it("does not load the sheet while it has never been opened", () => {
    const { LazySheet, load } = createLazySheet();

    render(<DeferredSheet open={false}><LazySheet /></DeferredSheet>);

    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByText("Sheet content")).toBeNull();
  });

  it("loads and shows the sheet on first open", async () => {
    const { LazySheet, load } = createLazySheet();
    const view = render(<DeferredSheet open={false}><LazySheet /></DeferredSheet>);

    await act(async () => { view.rerender(<DeferredSheet open><LazySheet /></DeferredSheet>); });

    expect(await screen.findByText("Sheet content")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps the sheet mounted after it was closed, without loading it again", async () => {
    const { LazySheet, load } = createLazySheet();
    const view = render(<DeferredSheet open><LazySheet /></DeferredSheet>);
    await screen.findByText("Sheet content");

    await act(async () => { view.rerender(<DeferredSheet open={false}><LazySheet /></DeferredSheet>); });

    expect(screen.getByText("Sheet content")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
