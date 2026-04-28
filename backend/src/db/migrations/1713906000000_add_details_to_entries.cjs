const shorthands = undefined;

function up(pgm) {
  pgm.addColumns("entries", {
    details: {
      type: "text",
      notNull: false
    }
  });
}

function down(pgm) {
  pgm.dropColumns("entries", ["details"]);
}

module.exports = {
  shorthands,
  up,
  down
};
