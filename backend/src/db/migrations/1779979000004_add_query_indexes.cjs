const shorthands = undefined;

// Indexes for the hot read paths (the pg_trgm index backs the ILIKE branch of the suggestions
// query). Before this migration only primary keys and unique constraints existed, so every entry,
// history, overview and suggestion query scanned the whole entries table.
//
// The pg_trgm extension is created explicitly because the GIN index depends on it; it used to be
// created only as a side effect of the (since removed) autocomplete history table. down() drops
// the indexes but deliberately keeps the extension: other objects or migrations may use it.
const INDEXES = [
  { name: "entries_list_status_created_idx", table: "entries", columns: ["list_id", "status", "created_at"] },
  { name: "entries_list_updated_idx", table: "entries", columns: ["list_id", "updated_at"] },
  { name: "lists_owner_idx", table: "lists", columns: ["owner_id"] },
  { name: "list_members_user_idx", table: "list_members", columns: ["user_id"] },
  { name: "pending_push_jobs_fire_at_idx", table: "pending_push_jobs", columns: ["fire_at"] },
  // Push subscriptions are unique per (user_id, endpoint) only; deleting by endpoint needs its own index.
  { name: "push_subscriptions_endpoint_idx", table: "push_subscriptions", columns: ["endpoint"] }
];

function up(pgm) {
  pgm.createExtension("pg_trgm", { ifNotExists: true });

  for (const { name, table, columns } of INDEXES) {
    pgm.createIndex(table, columns, { name });
  }

  pgm.createIndex("entries", "text", {
    name: "entries_text_trgm_idx",
    method: "gin",
    opclass: "gin_trgm_ops"
  });
}

function down(pgm) {
  pgm.dropIndex("entries", "text", { name: "entries_text_trgm_idx", ifExists: true });

  for (const { name, table, columns } of [...INDEXES].reverse()) {
    pgm.dropIndex(table, columns, { name, ifExists: true });
  }
}

module.exports = {
  shorthands,
  up,
  down
};
