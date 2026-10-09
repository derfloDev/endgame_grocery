import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { getConfig } from "../env.js";
import { getPoolOptions } from "./client.js";

describe("database pool settings", () => {
  const original = process.env.PG_POOL_MAX;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PG_POOL_MAX;
    } else {
      process.env.PG_POOL_MAX = original;
    }
  });

  it("defaults to 10 connections with connect and idle timeouts", () => {
    delete process.env.PG_POOL_MAX;

    assert.deepEqual(getPoolOptions({ ...getConfig(), databaseUrl: "postgres://db/x" }), {
      connectionString: "postgres://db/x",
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000
    });
  });

  it("reads the connection limit from PG_POOL_MAX", () => {
    process.env.PG_POOL_MAX = "25";

    assert.equal(getConfig().pgPoolMax, 25);
    assert.equal(getPoolOptions(getConfig()).max, 25);
  });

  it("ignores invalid values", () => {
    for (const value of ["", "abc", "0", "-3", "2.5", "2.5x"]) {
      process.env.PG_POOL_MAX = value;
      assert.equal(getConfig().pgPoolMax, 10, value);
    }
  });
});
