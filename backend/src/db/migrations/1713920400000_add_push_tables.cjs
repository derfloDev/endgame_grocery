const shorthands = undefined;

function up(pgm) {
  pgm.createTable("push_subscriptions", {
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
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.addConstraint("push_subscriptions", "push_subscriptions_user_endpoint_key", {
    unique: ["user_id", "endpoint"]
  });

  pgm.createTable("pending_push_jobs", {
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
      default: []
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.addConstraint("pending_push_jobs", "pending_push_jobs_list_actor_key", {
    unique: ["list_id", "actor_user_id"]
  });

  pgm.createTable("push_cooldowns", {
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
  });
}

function down(pgm) {
  pgm.dropTable("push_cooldowns", { ifExists: true, cascade: true });
  pgm.dropTable("pending_push_jobs", { ifExists: true, cascade: true });
  pgm.dropTable("push_subscriptions", { ifExists: true, cascade: true });
}

module.exports = {
  shorthands,
  up,
  down
};
