const shorthands = undefined;

function up(pgm) {
  pgm.createTable("list_invites", {
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
      default: pgm.func("gen_random_uuid()")
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
      default: pgm.func("CURRENT_TIMESTAMP")
    }
  });

  pgm.addConstraint("list_invites", "list_invites_status_check", {
    check: "status IN ('pending', 'accepted', 'declined')"
  });

  pgm.createIndex("list_invites", ["list_id", "invited_email"], {
    name: "list_invites_pending_email_idx",
    unique: true,
    where: "status = 'pending'"
  });
}

function down(pgm) {
  pgm.dropIndex("list_invites", ["list_id", "invited_email"], {
    name: "list_invites_pending_email_idx",
    ifExists: true
  });
  pgm.dropTable("list_invites", { ifExists: true, cascade: true });
}

module.exports = {
  shorthands,
  up,
  down
};
