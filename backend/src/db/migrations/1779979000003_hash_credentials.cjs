const shorthands = undefined;

// One-time tokens (email verification, password reset, list invites) and API keys are stored as
// lower-case hex SHA-256 digests of their canonical text form instead of in plaintext. The values
// are random UUIDs, so an unsalted digest cannot be brute-forced. Existing rows are converted in
// place, so links and keys that were already issued keep working.
//
// down() cannot restore the plaintext: it re-creates the old columns with fresh random values for
// tokens (pending links stop working) and empty API keys (users have to generate a new key).
const TOKEN_TABLES = [
  { table: "email_verification_tokens", keepDefault: false },
  { table: "password_reset_tokens", keepDefault: false },
  { table: "list_invites", keepDefault: true }
];

const HASH_SQL = (column) => `encode(sha256(convert_to(${column}::text, 'UTF8')), 'hex')`;

function up(pgm) {
  pgm.addColumns("users", {
    api_key_hash: { type: "text", unique: true },
    api_key_hint: { type: "text" },
    api_key_created_at: { type: "timestamptz" }
  });
  pgm.sql(`
    UPDATE users
    SET api_key_hash = ${HASH_SQL("api_key")},
        api_key_hint = right(api_key::text, 4),
        api_key_created_at = CURRENT_TIMESTAMP
    WHERE api_key IS NOT NULL
  `);
  pgm.dropColumns("users", ["api_key"]);

  for (const { table } of TOKEN_TABLES) {
    pgm.addColumns(table, { token_hash: { type: "text" } });
    pgm.sql(`UPDATE ${table} SET token_hash = ${HASH_SQL("token")}`);
    pgm.alterColumn(table, "token_hash", { notNull: true });
    pgm.addConstraint(table, `${table}_token_hash_key`, { unique: ["token_hash"] });
    pgm.dropColumns(table, ["token"]);
  }
}

function down(pgm) {
  for (const { table, keepDefault } of TOKEN_TABLES) {
    pgm.addColumns(table, {
      token: {
        type: "uuid",
        notNull: true,
        unique: true,
        default: pgm.func("gen_random_uuid()")
      }
    });
    if (!keepDefault) {
      pgm.alterColumn(table, "token", { default: null });
    }
    pgm.dropColumns(table, ["token_hash"]);
  }

  pgm.addColumns("users", { api_key: { type: "uuid", unique: true } });
  pgm.dropColumns("users", ["api_key_hash", "api_key_hint", "api_key_created_at"]);
}

module.exports = {
  shorthands,
  up,
  down
};
