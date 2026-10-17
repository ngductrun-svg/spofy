import { getDatabase } from '@netlify/database';

// node-postgres may return BIGINT columns as strings. All these values are
// bounded timestamps/counters, safely within JavaScript's integer precision.
const numbers = new Set(['created_at','updated_at','published_at','expires_at','last_login_at','occurred_at','window_start','applied_at','count','total','login_count','active_sessions']);
export function normalizeResult(result) {
  return { ...result, rows: result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key,value]) => [key,
    typeof value === 'bigint' ? Number(value) : numbers.has(key) && typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value,
  ]))) };
}

export function createDatabase(pool) {
  const scoped = connection => ({ query: async (sql, params = []) => normalizeResult(await connection.query(sql, params)) });
  return {
    ...scoped(pool),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(scoped(client));
        await client.query('COMMIT');
        return result;
      } catch (error) { try { await client.query('ROLLBACK'); } catch {} throw error; }
      finally { client.release(); }
    },
  };
}

let database;
export function netlifyDatabase() {
  // Netlify supplies a branch-specific connection string in the Function
  // environment. Nothing from this module is bundled into the browser.
  return database ??= createDatabase(getDatabase().pool);
}
