import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSseTickets } from "./sseTickets.js";

describe("SSE tickets", () => {
  it("issues unguessable url-safe tickets", () => {
    const tickets = createSseTickets();
    const first = tickets.issue("user-1");
    const second = tickets.issue("user-1");

    assert.match(first, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first, second);
  });

  it("returns the user id exactly once", () => {
    const tickets = createSseTickets();
    const ticket = tickets.issue("user-1");

    assert.equal(tickets.consume(ticket), "user-1");
    assert.equal(tickets.consume(ticket), null);
  });

  it("rejects unknown and malformed tickets", () => {
    const tickets = createSseTickets();

    assert.equal(tickets.consume("nope"), null);
    assert.equal(tickets.consume(""), null);
    assert.equal(tickets.consume(undefined), null);
    assert.equal(tickets.consume(["a"]), null);
  });

  it("expires tickets after 30 seconds", () => {
    let now = 1_000_000;
    const tickets = createSseTickets({ now: () => now });
    const ticket = tickets.issue("user-1");

    now += 29_999;
    assert.equal(tickets.consume(tickets.issue("user-2")), "user-2");

    now += 2;
    assert.equal(tickets.consume(ticket), null);
  });

  it("sweeps expired tickets when a new one is issued", () => {
    let now = 0;
    const tickets = createSseTickets({ now: () => now });
    tickets.issue("user-1");
    tickets.issue("user-2");
    assert.equal(tickets.size(), 2);

    now += 31_000;
    tickets.issue("user-3");

    assert.equal(tickets.size(), 1);
  });
});
