import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEMO_ENTRIES, DEMO_LIST, DEMO_USER } from "./seed-data.js";

describe("seed data", () => {
  it("defines the expected demo user", () => {
    assert.equal(DEMO_USER.email, "demo@endgame-grocery.local");
    assert.equal(DEMO_USER.password, "password123");
    assert.equal(DEMO_USER.displayName, "Demo Shopper");
  });

  it("defines one demo list and starter entries", () => {
    assert.equal(DEMO_LIST.name, "Weekend groceries");
    assert.deepEqual(DEMO_ENTRIES, ["Milk", "Tomatoes", "Coffee beans"]);
  });
});
