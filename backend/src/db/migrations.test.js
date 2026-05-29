import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const autocompleteHistoryMigrationPath = path.resolve(
  "src/db/migrations/1713902400000_add_autocomplete_history.cjs"
);
const detailsMigrationPath = path.resolve("src/db/migrations/1713906000000_add_details_to_entries.cjs");
const emailVerificationMigrationPath = path.resolve(
  "src/db/migrations/1713909600000_add_email_verification.cjs"
);
const passwordResetMigrationPath = path.resolve(
  "src/db/migrations/1713913200000_add_password_reset_tokens.cjs"
);
const listInvitesMigrationPath = path.resolve(
  "src/db/migrations/1713916800000_add_list_invites.cjs"
);
const pushTablesMigrationPath = path.resolve(
  "src/db/migrations/1713920400000_add_push_tables.cjs"
);
const apiKeyMigrationPath = path.resolve(
  "src/db/migrations/1778803200000_add_api_key_to_users.cjs"
);
const autocompleteHistoryDetailsMigrationPath = path.resolve(
  "src/db/migrations/1778803200001_add_details_to_autocomplete_history.cjs"
);
const dropAutocompleteHistoryMigrationPath = path.resolve(
  "src/db/migrations/1778803200002_drop_autocomplete_history.cjs"
);
const lastUpdatedByMigrationPath = path.resolve(
  "src/db/migrations/1779979000000_add_last_updated_by_to_entries.cjs"
);
const listViewsMigrationPath = path.resolve(
  "src/db/migrations/1779979000001_add_list_views.cjs"
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
    addColumns(...args) {
      calls.push(["addColumns", ...args]);
    },
    dropIndex(...args) {
      calls.push(["dropIndex", ...args]);
    },
    dropColumns(...args) {
      calls.push(["dropColumns", ...args]);
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

  it("adds and removes the details column on entries", async () => {
    const migration = await import(pathToFileURL(detailsMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "addColumns",
        "entries",
        {
          details: {
            type: "text",
            notNull: false
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [["dropColumns", "entries", ["details"]]]);
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

  it("adds email verification columns and token tables", async () => {
    const migration = await import(pathToFileURL(emailVerificationMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "addColumns",
        "users",
        {
          email_verified: {
            type: "boolean",
            notNull: true,
            default: true
          }
        }
      ],
      [
        "createTable",
        "email_verification_tokens",
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
          token: {
            type: "uuid",
            notNull: true,
            unique: true
          },
          expires_at: {
            type: "timestamptz",
            notNull: true
          },
          created_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [
      ["dropTable", "email_verification_tokens", { ifExists: true, cascade: true }],
      ["dropColumns", "users", ["email_verified"]]
    ]);
  });

  it("creates and removes password reset token tables", async () => {
    const migration = await import(pathToFileURL(passwordResetMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "createTable",
        "password_reset_tokens",
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
          token: {
            type: "uuid",
            notNull: true,
            unique: true
          },
          expires_at: {
            type: "timestamptz",
            notNull: true
          },
          used: {
            type: "boolean",
            notNull: true,
            default: false
          },
          created_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [
      ["dropTable", "password_reset_tokens", { ifExists: true, cascade: true }]
    ]);
  });

  it("creates and removes list invite tables", async () => {
    const migration = await import(pathToFileURL(listInvitesMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "createTable",
        "list_invites",
        {
          id: {
            type: "uuid",
            primaryKey: true,
            default: { value: "gen_random_uuid()" }
          },
          list_id: {
            type: "uuid",
            notNull: true,
            references: "lists(id)",
            onDelete: "CASCADE"
          },
          invited_email: {
            type: "text",
            notNull: true
          },
          invited_by: {
            type: "uuid",
            notNull: true,
            references: "users(id)",
            onDelete: "CASCADE"
          },
          token: {
            type: "uuid",
            notNull: true,
            unique: true,
            default: { value: "gen_random_uuid()" }
          },
          status: {
            type: "text",
            notNull: true,
            default: "pending"
          },
          expires_at: {
            type: "timestamptz",
            notNull: true
          },
          created_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ],
      [
        "addConstraint",
        "list_invites",
        "list_invites_status_check",
        {
          check: "status IN ('pending', 'accepted', 'declined')"
        }
      ],
      [
        "createIndex",
        "list_invites",
        ["list_id", "invited_email"],
        {
          name: "list_invites_pending_email_idx",
          unique: true,
          where: "status = 'pending'"
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [
      [
        "dropIndex",
        "list_invites",
        ["list_id", "invited_email"],
        { name: "list_invites_pending_email_idx", ifExists: true }
      ],
      ["dropTable", "list_invites", { ifExists: true, cascade: true }]
    ]);
  });

  it("creates and removes push notification tables", async () => {
    const migration = await import(pathToFileURL(pushTablesMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "createTable",
        "push_subscriptions",
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
          endpoint: {
            type: "text",
            notNull: true
          },
          p256dh: {
            type: "text",
            notNull: true
          },
          auth: {
            type: "text",
            notNull: true
          },
          created_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ],
      [
        "addConstraint",
        "push_subscriptions",
        "push_subscriptions_user_endpoint_key",
        { unique: ["user_id", "endpoint"] }
      ],
      [
        "createTable",
        "pending_push_jobs",
        {
          id: {
            type: "uuid",
            primaryKey: true,
            default: { value: "gen_random_uuid()" }
          },
          list_id: {
            type: "uuid",
            notNull: true,
            references: "lists(id)",
            onDelete: "CASCADE"
          },
          actor_user_id: {
            type: "uuid",
            notNull: true,
            references: "users(id)",
            onDelete: "CASCADE"
          },
          fire_at: {
            type: "timestamptz",
            notNull: true
          },
          items: {
            type: "jsonb",
            notNull: true,
            default: { value: "'[]'::jsonb" }
          },
          created_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ],
      [
        "addConstraint",
        "pending_push_jobs",
        "pending_push_jobs_list_actor_key",
        { unique: ["list_id", "actor_user_id"] }
      ],
      [
        "createTable",
        "push_cooldowns",
        {
          list_id: {
            type: "uuid",
            primaryKey: true,
            references: "lists(id)",
            onDelete: "CASCADE"
          },
          last_sent_at: {
            type: "timestamptz",
            notNull: true
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [
      ["dropTable", "push_cooldowns", { ifExists: true, cascade: true }],
      ["dropTable", "pending_push_jobs", { ifExists: true, cascade: true }],
      ["dropTable", "push_subscriptions", { ifExists: true, cascade: true }]
    ]);
  });

  it("adds and removes the api_key column on users", async () => {
    const migration = await import(pathToFileURL(apiKeyMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "addColumns",
        "users",
        {
          api_key: {
            type: "uuid",
            unique: true
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [["dropColumns", "users", ["api_key"]]]);
  });

  it("adds and removes the details column on autocomplete history", async () => {
    const migration = await import(pathToFileURL(autocompleteHistoryDetailsMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "addColumns",
        "autocomplete_history",
        {
          details: {
            type: "text",
            notNull: false
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [["dropColumns", "autocomplete_history", ["details"]]]);
  });

  it("drops and restores the autocomplete_history table", async () => {
    const migration = await import(pathToFileURL(dropAutocompleteHistoryMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [["dropTable", "autocomplete_history", { ifExists: true, cascade: true }]]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [
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
          details: {
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
  });

  it("adds and removes the last_updated_by column on entries", async () => {
    const migration = await import(pathToFileURL(lastUpdatedByMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "addColumns",
        "entries",
        {
          last_updated_by: {
            type: "uuid",
            notNull: false,
            references: "users(id)",
            onDelete: "SET NULL"
          }
        }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [["dropColumns", "entries", ["last_updated_by"]]]);
  });

  it("creates and removes per-user list view tracking", async () => {
    const migration = await import(pathToFileURL(listViewsMigrationPath));
    const { calls, pgm } = createPgmSpy();

    assert.doesNotThrow(() => migration.up(pgm));
    assert.deepEqual(calls, [
      [
        "createTable",
        "list_views",
        {
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
          last_viewed_at: {
            type: "timestamptz",
            notNull: true,
            default: { value: "CURRENT_TIMESTAMP" }
          }
        }
      ],
      [
        "addConstraint",
        "list_views",
        "list_views_pkey",
        { primaryKey: ["user_id", "list_id"] }
      ]
    ]);

    calls.length = 0;

    assert.doesNotThrow(() => migration.down(pgm));
    assert.deepEqual(calls, [["dropTable", "list_views", { ifExists: true, cascade: true }]]);
  });
});
