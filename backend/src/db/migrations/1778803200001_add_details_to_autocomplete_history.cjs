const shorthands = undefined;

function up(pgm) {
  pgm.addColumns("autocomplete_history", {
    details: {
      type: "text",
      notNull: false
    }
  });
}

function down(pgm) {
  pgm.dropColumns("autocomplete_history", ["details"]);
}

module.exports = {
  shorthands,
  up,
  down
};
