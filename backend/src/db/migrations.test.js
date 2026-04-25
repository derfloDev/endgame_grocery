import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

describe("database migrations", () => {
  it("exports up and down migration functions", async () => {
    const migrationPath = path.resolve("src/db/migrations/1713895200000_create_core_tables.cjs");
    const migration = await import(pathToFileURL(migrationPath));

    assert.equal(typeof migration.up, "function");
    assert.equal(typeof migration.down, "function");
  });

  it("exports up and down functions for the icon migration", async () => {
    const migrationPath = path.resolve("src/db/migrations/1713898800000_add_icon_to_entries.cjs");
    const migration = await import(pathToFileURL(migrationPath));

    assert.equal(typeof migration.up, "function");
    assert.equal(typeof migration.down, "function");
  });
});
