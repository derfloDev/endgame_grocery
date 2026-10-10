import { vi } from "vitest";

/** Minimal response fixture; the fake supplies real Response status and body semantics. */
export interface FetchReply {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}

type Handler = (input: RequestInfo | URL, init: RequestInit) => FetchReply | Promise<FetchReply>;
type Route = { method: string; path: string | RegExp; handler: Handler };

/**
 * Dispatch fixtures by method and pathname + query, never by global request order.
 * Register specific scenarios after defaults: the last matching route wins. Call
 * assertAllMatched in afterEach, because application error handling can catch a rejected fetch.
 * fetch.mock.calls retains the original inputs for existing request/order assertions.
 */
export function createFetchRoutes() {
  const routes: Route[] = [];
  const unmatched: string[] = [];

  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init = {}) => {
    const request = input instanceof Request ? input : undefined;
    const url = new URL(request?.url ?? String(input), "http://localhost");
    const path = `${url.pathname}${url.search}`;
    const method = (init.method ?? request?.method ?? "GET").toUpperCase();
    const route = routes.findLast((candidate) => {
      if (candidate.method !== method) return false;
      if (typeof candidate.path === "string") return candidate.path === path;
      candidate.path.lastIndex = 0;
      return candidate.path.test(path);
    });
    if (!route) {
      const message = `Unhandled fetch: ${method} ${path}`;
      unmatched.push(message);
      throw new Error(message);
    }
    const reply = await route.handler(input, init);
    const status = reply.status ?? (reply.ok === false ? 400 : 200);
    const body = [204, 205, 304].includes(status) ? null : JSON.stringify(await reply.json?.());
    return new Response(body, { status, headers: { "Content-Type": "application/json" } });
  });

  return {
    fetch,
    on(method: string, path: string | RegExp, handler: Handler) {
      routes.push({ method: method.toUpperCase(), path, handler });
    },
    assertAllMatched() {
      if (unmatched.length) throw new Error(unmatched.join("\n"));
    },
    reset() {
      routes.length = 0;
      unmatched.length = 0;
      fetch.mockClear();
    }
  };
}
