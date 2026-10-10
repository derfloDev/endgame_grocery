import { describe, expect, it } from "vitest";
import { createFetchRoutes } from "./fetchRoutes";

describe("route-based fetch fixtures", () => {
  it("matches method and path independently of request order and records original arguments", async () => {
    const routes = createFetchRoutes();
    routes.on("GET", "/api/lists", () => ({ json: async () => ({ lists: [] }) }));
    routes.on("POST", "/api/lists", (_input, init) => ({ status: 201, json: async () => JSON.parse(String(init.body)) }));
    const init = { method: "POST", body: JSON.stringify({ name: "Pantry" }) };
    expect(await (await routes.fetch("/api/lists", init)).json()).toEqual({ name: "Pantry" });
    expect(await (await routes.fetch("/api/lists")).json()).toEqual({ lists: [] });
    expect(routes.fetch.mock.calls).toEqual([["/api/lists", init], ["/api/lists"]]);
    expect(() => routes.assertAllMatched()).not.toThrow();
  });

  it("supports URL and Request inputs and an init method override", async () => {
    const routes = createFetchRoutes();
    routes.on("PATCH", "/api/lists/7?mode=rename", () => ({ status: 204 }));
    const url = new URL("https://grocery.test/api/lists/7?mode=rename");
    expect((await routes.fetch(url, { method: "patch" })).status).toBe(204);
    expect((await routes.fetch(new Request(url, { method: "DELETE" }), { method: "PATCH" })).status).toBe(204);
    routes.on("DELETE", "/api/lists/7?mode=rename", () => ({ status: 204 }));
    expect((await routes.fetch(new Request(url, { method: "DELETE" }))).status).toBe(204);
  });

  it("matches path patterns repeatedly without leaking RegExp lastIndex", async () => {
    const routes = createFetchRoutes();
    routes.on("GET", /^\/api\/lists\/[^/]+\/suggestions\?q=/g, () => ({ json: async () => ({ suggestions: [] }) }));
    for (const query of ["milk", "bread", "milk"]) {
      expect(await (await routes.fetch(`/api/lists/7/suggestions?q=${query}`)).json()).toEqual({ suggestions: [] });
    }
    expect(() => routes.assertAllMatched()).not.toThrow();
  });

  it("rejects unmatched methods/queries and still fails verification if the caller catches them", async () => {
    const routes = createFetchRoutes();
    routes.on("GET", "/api/lists", () => ({ json: async () => ({ lists: [] }) }));
    await expect(routes.fetch("/api/lists", { method: "DELETE" })).rejects.toThrow("Unhandled fetch: DELETE /api/lists");
    await routes.fetch("/api/lists?unexpected=true").catch(() => {});
    expect(() => routes.assertAllMatched()).toThrow("DELETE /api/lists");
    expect(() => routes.assertAllMatched()).toThrow("GET /api/lists?unexpected=true");
  });

  it("allows a later route override and gives every request a fresh readable response", async () => {
    const routes = createFetchRoutes();
    routes.on("GET", "/api/lists", () => ({ json: async () => ({ lists: [] }) }));
    routes.on("GET", "/api/lists", () => ({ ok: false, status: 403, json: async () => ({ error: "Denied" }) }));
    for (let i = 0; i < 2; i++) {
      const response = await routes.fetch("/api/lists");
      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "Denied" });
    }
  });

  it("supports pending responses and deliberate network failures without calling them unmatched", async () => {
    const routes = createFetchRoutes();
    let finish!: (value: { status: number }) => void;
    routes.on("GET", "/pending", () => new Promise((resolve) => { finish = resolve; }));
    routes.on("GET", "/offline", () => { throw new TypeError("Failed to fetch"); });
    const pending = routes.fetch("/pending");
    await expect(routes.fetch("/offline")).rejects.toThrow("Failed to fetch");
    finish({ status: 204 });
    expect((await pending).status).toBe(204);
    expect(() => routes.assertAllMatched()).not.toThrow();
  });

  it("clears registrations, request history and unmatched failures between tests", async () => {
    const routes = createFetchRoutes();
    routes.on("GET", "/old", () => ({ status: 204 }));
    await routes.fetch("/missing").catch(() => {});
    routes.reset();
    expect(routes.fetch).not.toHaveBeenCalled();
    expect(() => routes.assertAllMatched()).not.toThrow();
    await expect(routes.fetch("/old")).rejects.toThrow("Unhandled fetch: GET /old");
  });
});
