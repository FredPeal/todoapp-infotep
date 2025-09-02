// db.js (CommonJS)
const mysql = require("mysql2/promise");

let pool;
let pingTimer;

const RETRY_ERRS = new Set([
  "PROTOCOL_ENQUEUE_AFTER_QUIT",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "POOL_CLOSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);

function buildPool() {
  const p = mysql.createPool({
    host: process.env.DB_HOST || "mysql-db",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "rootpassword",
    database: process.env.DB_NAME || "todoapp",
    port: Number(process.env.DB_PORT || 3306),

    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
    queueLimit: 0,

    connectTimeout: 20_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
  });

  // Ping periódico (mantiene vivo y detecta cortes)
  pingTimer = setInterval(async () => {
    try {
      await p.query("SELECT 1");
    } catch (_) {}
  }, 30_000);

  return p;
}

function ensurePool() {
  if (!pool) pool = buildPool();
  return pool;
}

// Espera a que la BD esté lista (porque depends_on no aplica en ACA)
async function waitForDbReady({ retries = 24, delayMs = 5000 } = {}) {
  const p = ensurePool();
  for (let i = 1; i <= retries; i++) {
    try {
      await p.query("SELECT 1");
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("DB not ready after retries");
}

// Ejecuta queries con reintento y recreación del pool si se cerró
async function dbQuery(sql, params, attempts = 3) {
  const p = ensurePool();
  try {
    const [rows] = await p.query(sql, params);
    return rows;
  } catch (e) {
    if (
      attempts > 1 &&
      (RETRY_ERRS.has(e.code) || /closed state/i.test(e.message))
    ) {
      try {
        clearInterval(pingTimer);
      } catch {}
      try {
        await pool?.end().catch(() => {});
      } catch {}
      pool = undefined;
      await new Promise((r) => setTimeout(r, 500)); // pequeño backoff
      return dbQuery(sql, params, attempts - 1);
    }
    throw e;
  }
}

async function closePool() {
  try {
    clearInterval(pingTimer);
  } catch {}
  try {
    await pool?.end();
  } catch {}
  pool = undefined;
}

module.exports = { waitForDbReady, dbQuery, closePool };
