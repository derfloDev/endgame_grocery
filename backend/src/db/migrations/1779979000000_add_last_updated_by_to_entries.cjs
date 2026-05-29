const shorthands = undefined;

function up(pgm) {
  pgm.addColumns("entries", {
    last_updated_by: {
      type: "uuid",
      notNull: false,
      references: "users(id)",
      onDelete: "SET NULL"
    }
  });
}

function down(pgm) {
  pgm.dropColumns("entries", ["last_updated_by"]);
}

module.exports = {
  shorthands,
  up,
  down
};
