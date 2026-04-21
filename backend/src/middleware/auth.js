export function requireAuth(_req, res, next) {
  res.status(501).json({ error: "Authentication middleware is not implemented yet." });
  next();
}
