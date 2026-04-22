const shorthands = undefined;

function up(pgm) {
  pgm.createExtension("pgcrypto", {
    ifNotExists: true
  });

  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    email: {
      type: "text",
      notNull: true,
      unique: true
    },
    password_hash: {
      type: "text",
      notNull: true
    },
    display_name: {
      type: "text",
      notNull: true
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.createTable("lists", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
    },
    name: {
      type: "text",
      notNull: true
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE"
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.createTable("list_members", {
    list_id: {
      type: "uuid",
      notNull: true,
      references: "lists(id)",
      onDelete: "CASCADE"
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE"
    },
    joined_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });
  pgm.addConstraint("list_members", "list_members_pkey", {
    primaryKey: ["list_id", "user_id"]
  });

  pgm.createTable("entries", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()")
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
    status: {
      type: "text",
      notNull: true,
      default: "open"
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });
  pgm.addConstraint("entries", "entries_status_check", {
    check: "status IN ('open', 'done')"
  });
}

function down(pgm) {
  pgm.dropTable("entries");
  pgm.dropTable("list_members");
  pgm.dropTable("lists");
  pgm.dropTable("users");
}

module.exports = {
  shorthands,
  up,
  down
};
