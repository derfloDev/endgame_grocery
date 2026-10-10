import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "./safeRedirect";

describe("getSafeRedirect", () => {
  it.each(["/", "/lists/abc", "/invite/token-1", "/lists/abc?x=1#y"])("keeps the in-app path %s", (path) => {
    expect(getSafeRedirect(path)).toBe(path);
  });

  it.each([
    "//evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "/\\/evil.example",
    "https://evil.example",
    "http://evil.example/lists",
    "javascript:alert(1)",
    "evil.example",
    "lists/abc",
    "",
    "/\t/evil.example",
    "/\n/evil.example",
    "\\\\evil.example"
  ])("falls back to / for %j", (value) => {
    expect(getSafeRedirect(value)).toBe("/");
  });

  it.each([null, undefined, 42, {}, ["/lists"]])("falls back to / for the non-string %j", (value) => {
    expect(getSafeRedirect(value)).toBe("/");
  });
});
