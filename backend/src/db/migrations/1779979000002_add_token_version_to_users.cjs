const shorthands = undefined;

// `token_version` is stored in every JWT as `tv`. Bumping it (for example on a password reset)
// makes all previously issued tokens of that user invalid. Existing users start at 0, which is
// also what a token without a `tv` claim is treated as, so current sessions stay valid.
function up(pgm) {
  pgm.addColumns("users", {
    token_version: {
      type: "integer",
      notNull: true,
      default: 0
    }
  });
}

function down(pgm) {
  pgm.dropColumns("users", ["token_version"]);
}

module.exports = {
  shorthands,
  up,
  down
};
