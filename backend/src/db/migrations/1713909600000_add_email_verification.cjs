const shorthands = undefined;

function up(pgm) {
  pgm.addColumns("users", {
    email_verified: {
      type: "boolean",
      notNull: true,
      default: true
    }
  });

  pgm.createTable("email_verification_tokens", {
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
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });
}

function down(pgm) {
  pgm.dropTable("email_verification_tokens", { ifExists: true, cascade: true });
  pgm.dropColumns("users", ["email_verified"]);
}

module.exports = {
  shorthands,
  up,
  down
};
