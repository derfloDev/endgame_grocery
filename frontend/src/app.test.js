import { describe, expect, it } from "vitest";
import { APP_TITLE } from "./app.constants";

describe("app scaffold", () => {
  it("exposes the project title constant", () => {
    expect(APP_TITLE).toBe("Endgame Grocery");
  });
});
