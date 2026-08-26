// ============================================================
// Database Connection — SQLite via sql.js (pure JS, no native)
// ============================================================

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

/**
 * Returns the singleton SQLite database connection.
 * Creates the database file and tables if they don't exist.
 */
export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();

  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbPath = path.join(dbDir, 'commerce.db');

  // Load existing DB or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Initialize schema
  initSchema(db);
  saveDb();

  return db;
}

/**
 * Returns a test database (in-memory) for unit tests.
 */
export async function getTestDb(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();
  const testDb = new SQL.Database();
  initSchema(testDb);
  return testDb;
}

/**
 * Save the database to disk.
 */
export function saveDb(): void {
  if (db && dbPath) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

/**
 * Initialize database schema — creates all tables if they don't exist.
 */
function initSchema(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trust_tier TEXT NOT NULL DEFAULT 'UNRATED',
      description TEXT,
      policies TEXT NOT NULL DEFAULT '[]',
      delivery_regions TEXT NOT NULL DEFAULT '[]',
      payment_capabilities TEXT NOT NULL DEFAULT '[]',
      business_rules TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      stock INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0,
      delivery_days INTEGER NOT NULL DEFAULT 7,
      merchant_trust_tier TEXT NOT NULL DEFAULT 'UNRATED',
      attributes TEXT NOT NULL DEFAULT '{}',
      tags TEXT NOT NULL DEFAULT '[]',
      image_url TEXT,
      availability TEXT NOT NULL DEFAULT 'IN_STOCK',
      offer_eligibility TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL DEFAULT 'CREATED',
      intent_id TEXT,
      intent_raw TEXT,
      selected_product_id TEXT,
      selected_product_name TEXT,
      selected_product_price REAL,
      policy_result TEXT,
      approval_status TEXT,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      idempotency_key TEXT UNIQUE NOT NULL,
      failure_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      transaction_id TEXT NOT NULL,
      event TEXT NOT NULL,
      result TEXT NOT NULL,
      reason TEXT,
      metadata TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      value REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Indexes
  database.run(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_products_merchant ON products(merchant_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_audit_transaction ON audit_events(transaction_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_transactions_state ON transactions(state)`);
}
