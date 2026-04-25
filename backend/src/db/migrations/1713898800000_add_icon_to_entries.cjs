const shorthands = undefined;

function up(pgm) {
  pgm.addColumns("entries", {
    icon: {
      type: "text",
      notNull: false
    }
  });
}

function down(pgm) {
  pgm.dropColumns("entries", ["icon"]);
}

module.exports = {
  shorthands,
  up,
  down
};
