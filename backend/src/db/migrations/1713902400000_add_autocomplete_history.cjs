const shorthands = undefined;

function up(pgm) {
  pgm.createExtension("pg_trgm", {
    ifNotExists: true
  });

  pgm.createTable("autocomplete_history", {
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
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.addConstraint("autocomplete_history", "autocomplete_history_user_list_text_key", {
    unique: ["user_id", "list_id", "text"]
  });

  pgm.createIndex("autocomplete_history", ["user_id", "list_id"], {
    name: "autocomplete_history_user_list_idx"
  });
}

function down(pgm) {
  pgm.dropIndex("autocomplete_history", ["user_id", "list_id"], {
    name: "autocomplete_history_user_list_idx",
    ifExists: true
  });
  pgm.dropTable("autocomplete_history", {
    ifExists: true,
    cascade: true
  });
  pgm.dropExtension("pg_trgm", {
    ifExists: true
  });
}

module.exports = {
  shorthands,
  up,
  down
};
