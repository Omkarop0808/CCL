import pkg from 'pg';
const { Pool } = pkg;
import { computeRowId } from './rowId.js';

let _pool = null;
let _tableInitialized = false;

export function isRdsEnabled() {
  const host = process.env.DB_HOST || process.env.RDS_HOST;
  const password = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;
  return Boolean(host && password);
}

export function getRdsPool() {
  if (!isRdsEnabled()) return null;
  if (_pool) return _pool;

  const host = process.env.DB_HOST || process.env.RDS_HOST;
  const port = Number(process.env.DB_PORT || process.env.RDS_PORT || 5432);
  const database = process.env.DB_NAME || process.env.RDS_NAME || 'sahaya_db';
  const user = process.env.DB_USER || process.env.RDS_USER || 'postgres';
  const password = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

  _pool = new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false }, // Required for secure AWS RDS connections
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

  _pool.on('error', (err) => {
    console.error('[Amazon RDS] Unexpected PostgreSQL pool error:', err.message);
  });

  return _pool;
}

/**
 * Initializes the app_data_rows table in Amazon RDS PostgreSQL
 */
export async function initRdsTable() {
  if (_tableInitialized || !isRdsEnabled()) return;
  const pool = getRdsPool();
  if (!pool) return;

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_data_rows (
          collection VARCHAR(120) NOT NULL,
          row_id VARCHAR(255) NOT NULL,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (collection, row_id)
        );
        CREATE INDEX IF NOT EXISTS idx_app_data_rows_collection ON app_data_rows(collection);
      `);
      _tableInitialized = true;
      console.log('[Amazon RDS] PostgreSQL table "app_data_rows" initialized successfully.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn(`[Amazon RDS] Table initialization warning (${err.message}). Will retry on query.`);
  }
}

/**
 * Reads all rows for a collection from Amazon RDS
 */
export async function readRDS(collection) {
  const pool = getRdsPool();
  if (!pool) return [];

  await initRdsTable();
  const res = await pool.query(
    'SELECT payload FROM app_data_rows WHERE collection = $1 ORDER BY updated_at ASC',
    [collection]
  );
  return res.rows.map((r) => r.payload);
}

/**
 * Persists an array of collection objects to Amazon RDS
 */
export async function writeRDS(collection, rows) {
  const pool = getRdsPool();
  if (!pool) return;

  await initRdsTable();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Compute rows with keys
    const items = rows.map((d) => ({
      collection,
      row_id: computeRowId(collection, d),
      payload: JSON.stringify(d),
      updated_at: new Date().toISOString(),
    }));

    const nextIds = new Set(items.map((i) => i.row_id));

    // 2. Delete stale rows for this collection
    const existingRes = await client.query(
      'SELECT row_id FROM app_data_rows WHERE collection = $1',
      [collection]
    );
    const staleIds = existingRes.rows
      .map((r) => r.row_id)
      .filter((id) => !nextIds.has(id));

    if (staleIds.length > 0) {
      await client.query(
        'DELETE FROM app_data_rows WHERE collection = $1 AND row_id = ANY($2::text[])',
        [collection, staleIds]
      );
    }

    // 3. Upsert current rows
    for (const item of items) {
      await client.query(
        `INSERT INTO app_data_rows (collection, row_id, payload, updated_at)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (collection, row_id)
         DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at`,
        [item.collection, item.row_id, item.payload, item.updated_at]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw new Error(`RDS write ${collection}: ${err.message}`);
  } finally {
    client.release();
  }
}
