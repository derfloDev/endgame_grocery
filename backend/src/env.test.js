import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getConfig } from "./env.js";

describe("getConfig", () => {
  it("falls back to the default port", () => {
    const previousPort = process.env.PORT;

    delete process.env.PORT;

    assert.equal(getConfig().port, 4000);

    if (previousPort) {
      process.env.PORT = previousPort;
    }
  });
});
