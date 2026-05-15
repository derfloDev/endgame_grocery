const shorthands = undefined;

function up(pgm) {
  pgm.addColumns("users", {
    api_key: {
      type: "uuid",
      unique: true
    }
  });
}

function down(pgm) {
  pgm.dropColumns("users", ["api_key"]);
}

module.exports = {
  shorthands,
  up,
  down
};
