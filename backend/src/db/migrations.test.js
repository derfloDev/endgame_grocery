import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const autocompleteHistoryMigrationPath = path.resolve(
  "src/db/migrations/1713902400000_add_autocomplete_history.cjs"
);

function createPgmSpy() {
  const calls = [];
  const pgm = {
    func(value) {
      return { value };
    },
    createExtension(...args) {
      calls.push(["createExtension", ...args]);
    },
    createTable(...args) {
      calls.push(["createTable", ...args]);
    },
    addConstraint(...args) {
      calls.push(["addConstraint", ...args]);
    },
    createIndex(...args) {
      calls.push(["createIndex", ...args]);
    },
    dropIndex(...args) {
      calls.push(["dropIndex", ...args]);
    },
    dropTable(...args) {
      calls.push(["dropTable", ...args]);
    },
    dropExtension(...args) {
      calls.push(["dropExtension", ...args]);
    }
  };

  return { calls, pgm };
}

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

  it("creates and removes autocomplete history schema objects", async () => {
    const migration = await import(pathToFileURL(autocompleteHistoryMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      ["createExtension", "pg_trgm", { ifNotExists: true }],
      [
        "createTable",
        "autocomplete_history",
        {
          id: {
            type: "uuid",
            primaryKey: true,
            default: { value: "gen_random_uuid()" }
          },
          user_id: {
            type: "uuid",
            notNull: true,
            references: "users(id)",
            onDelete: "CASCADE"
          },
          list_id: {
            type: "uuid",
            notNull: true,
            references: "lists(id)",
            onDelete: "CASCADE"
          },
          text: {
            type: "text",
            notNull: true
          },
          icon: {
            type: "text",
            notNull: false
          },
          use_count: {
            type: "integer",
            notNull: true,
            default: 1
          },
          last_used_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ],
      [
        "addConstraint",
        "autocomplete_history",
        "autocomplete_history_user_list_text_key",
        { unique: ["user_id", "list_id", "text"] }
      ],
      [
        "createIndex",
        "autocomplete_history",
        ["user_id", "list_id"],
        { name: "autocomplete_history_user_list_idx" }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [
      [
        "dropIndex",
        "autocomplete_history",
        ["user_id", "list_id"],
        { name: "autocomplete_history_user_list_idx", ifExists: true }
      ],
      ["dropTable", "autocomplete_history", { ifExists: true, cascade: true }],
      ["dropExtension", "pg_trgm", { ifExists: true }]
    ]);
  });
});
