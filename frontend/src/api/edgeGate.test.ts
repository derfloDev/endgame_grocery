import { describe, expect, it } from "vitest";
import { detectEdgeGate, EdgeGateError } from "./edgeGate";

describe("edge gate classification", () => {
  it("recognizes an opaque manual redirect", () => {
    expect(detectEdgeGate({ type: "opaqueredirect" } as Response)).toBe("redirect");
  });
  it.each([301, 302, 303, 307, 308])("recognizes redirect %s", status => {
    expect(detectEdgeGate(new Response(null, { status }))).toBe("redirect");
  });
  it.each([200, 401, 403, 503])("recognizes a challenge at status %s", status => {
    expect(detectEdgeGate(new Response(null, { status, headers: { "cf-mitigated": "challenge" } }))).toBe("challenge");
  });
  it.each([401, 403])("separates HTML gate status %s from backend JSON", status => {
    expect(detectEdgeGate(new Response(null, { status, headers: { "Content-Type": "text/html" } }))).toBe(`status-${status}`);
    expect(detectEdgeGate(new Response(null, { status }))).toBe(`status-${status}`);
    for (const contentType of ["application/json; charset=utf-8", "application/problem+json", "Application/JSON"]) {
      const response = new Response(null, { status, headers: { "Content-Type": contentType } });
      expect(detectEdgeGate(response)).toBeNull();
      expect(detectEdgeGate(response, { anyAuthStatus: true })).toBe(`status-${status}`);
    }
  });
  it.each([200, 204, 404, 500, 503])("does not classify status %s alone as a gate", status => {
    expect(detectEdgeGate(new Response(null, { status }))).toBeNull();
  });
  it("exposes the reason on an identifiable error", () => {
    const error = new EdgeGateError("challenge");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("EdgeGateError");
    expect(error.reason).toBe("challenge");
  });
});
