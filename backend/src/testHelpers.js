/**
 * Gives a fake pool a `connect()` for routes that use transactions. BEGIN/COMMIT/ROLLBACK are not
 * forwarded, so a fake's ordered query expectations only describe the real statements.
 *
 * @template T
 * @param {T} pool Fake pool with an async `query(sql, params)`.
 * @returns {T} The same pool, extended with `connect()`.
 */
export function withTransactions(pool) {
  if (!pool || pool.connect) {
    return pool;
  }

  pool.connect = async () => ({
    query: (sql, params) =>
      /^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/.test(sql) ? Promise.resolve({ rows: [] }) : pool.query(sql, params),
    release() {}
  });

  return pool;
}
