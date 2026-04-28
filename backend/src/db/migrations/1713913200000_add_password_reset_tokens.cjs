const shorthands = undefined;

function up(pgm) {
  pgm.createTable("password_reset_tokens", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
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
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });
}

function down(pgm) {
  pgm.dropTable("password_reset_tokens", { ifExists: true, cascade: true });
}

module.exports = {
  shorthands,
  up,
  down
};
