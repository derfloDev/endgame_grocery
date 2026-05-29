const shorthands = undefined;

function up(pgm) {
  pgm.createTable("list_views", {
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
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.addConstraint("list_views", "list_views_pkey", {
    primaryKey: ["user_id", "list_id"]
  });
}

function down(pgm) {
  pgm.dropTable("list_views", { ifExists: true, cascade: true });
}

module.exports = {
  shorthands,
  up,
  down
};
