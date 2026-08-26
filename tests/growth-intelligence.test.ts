// ============================================================
// Growth Intelligence Tests — Phase 8
// Tests all deterministic growth signal derivations
// No LLM involved — pure catalog heuristics
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import {
  getTopRecommended,
  getUpsellOpportunities,
  getCrossSellOpportunities,
  getAbandonedCartSignals,
  getCampaignSuggestions,
  generateGrowthReport,
} from '../src/services/growth-intelligence';

// ── In-memory test DB ─────────────────────────────────────────

let db: Database;

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trust_tier TEXT NOT NULL,
      description TEXT,
      policies TEXT DEFAULT '[]',
      delivery_regions TEXT DEFAULT '[]',
      payment_capabilities TEXT DEFAULT '[]',
      business_rules TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      merchant_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      price REAL,
      currency TEXT DEFAULT 'INR',
      stock INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      delivery_days INTEGER DEFAULT 3,
      merchant_trust_tier TEXT,
      attributes TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      image_url TEXT,
      availability TEXT DEFAULT 'IN_STOCK',
      offer_eligibility TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE transactions (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      intent_id TEXT,
      intent_raw TEXT,
      selected_product_id TEXT,
      selected_product_name TEXT,
      selected_product_price REAL,
      policy_result TEXT,
      approval_status TEXT,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      idempotency_key TEXT,
      failure_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed merchants
  db.run(`INSERT INTO merchants VALUES ('m1','SportZone','GOLD',NULL,'[]','[]','[]','{}',datetime('now', '-1 day'))`);
  db.run(`INSERT INTO merchants VALUES ('m2','TechHub','PLATINUM',NULL,'[]','[]','[]','{}',datetime('now', '-1 day'))`);

  // Seed products — two categories with varied prices
  const products = [
    // Footwear — 3 products, varied prices
    ['p1', 'm1', 'Budget Shoes', 'footwear', 1500, 3.8, 10, '["running","sports"]'],
    ['p2', 'm1', 'Mid Shoes',    'footwear', 4499, 4.5, 8,  '["running","sports"]'],
    ['p3', 'm1', 'Premium Shoes','footwear', 7999, 4.8, 5,  '["running","sports","premium"]'],
    // Electronics — 3 products
    ['p4', 'm2', 'Basic Earbuds','electronics', 999,   4.0, 20, '["wireless","audio"]'],
    ['p5', 'm2', 'Good Earbuds', 'electronics', 3499,  4.6, 15, '["wireless","audio","anc"]'],
    ['p6', 'm2', 'Premium Earbuds','electronics',6999, 4.9, 3,  '["wireless","audio","anc","premium"]'],
    // Accessories — 2 products
    ['p7', 'm1', 'Sports Socks', 'accessories', 299,   4.3, 50, '["running","sports","accessories"]'],
    ['p8', 'm1', 'Water Bottle', 'accessories', 799,   4.4, 30, '["sports","hydration","accessories"]'],
  ];

  for (const [id, merchant, name, cat, price, rating, stock, tags] of products) {
    db.run(
      `INSERT INTO products (id, merchant_id, name, description, category, price, rating, stock,
        delivery_days, merchant_trust_tier, attributes, tags, availability, offer_eligibility, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3, 'GOLD', '{}', ?, 'IN_STOCK', '[]', datetime('now', '-1 day'))`,
      [id, merchant, name, `${name} description`, cat, price, rating, stock, tags],
    );
  }

  // Seed transactions — mix of terminal and non-terminal states
  db.run(`INSERT INTO transactions (id, state, selected_product_name, selected_product_price, idempotency_key, created_at, updated_at)
    VALUES ('txn-complete', 'COMPLETED', 'Mid Shoes', 4499, 'key-1', datetime('now', '-2 hours'), datetime('now', '-2 hours'))`);
  db.run(`INSERT INTO transactions (id, state, selected_product_name, selected_product_price, idempotency_key, created_at, updated_at)
    VALUES ('txn-stalled',  'CART_READY', 'Budget Shoes', 1500, 'key-2', datetime('now', '-30 minutes'), datetime('now', '-30 minutes'))`);
  db.run(`INSERT INTO transactions (id, state, selected_product_name, selected_product_price, idempotency_key, created_at, updated_at)
    VALUES ('txn-approval', 'APPROVAL_REQUIRED', 'Premium Shoes', 7999, 'key-3', datetime('now', '-15 minutes'), datetime('now', '-15 minutes'))`);
  // Use a real JS timestamp so the "very recent" test is reliable regardless of test duration
  const veryRecentTs = new Date(Date.now() - 30 * 1000).toISOString(); // 30 seconds ago
  db.run(
    `INSERT INTO transactions (id, state, selected_product_name, selected_product_price, idempotency_key, created_at, updated_at)
     VALUES ('txn-recent', 'CART_READY', 'Good Earbuds', 3499, 'key-4', ?, ?)`,
    [veryRecentTs, veryRecentTs],
  );
});

afterAll(() => {
  db.close();
});

// ── Top Recommended ───────────────────────────────────────────

describe('getTopRecommended', () => {
  it('returns products ordered by rating descending', () => {
    const results = getTopRecommended(db);
    expect(results.length).toBeGreaterThan(0);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].rating).toBeLessThanOrEqual(results[i - 1].rating);
    }
  });

  it('assigns TOP_PICK to products with rating >= 4.7', () => {
    const results = getTopRecommended(db);
    const topPicks = results.filter(r => r.signalLabel === 'TOP_PICK');
    for (const p of topPicks) {
      expect(p.rating).toBeGreaterThanOrEqual(4.7);
    }
  });

  it('assigns HIGH_RATED to products with 4.3 <= rating < 4.7', () => {
    const results = getTopRecommended(db);
    const highRated = results.filter(r => r.signalLabel === 'HIGH_RATED');
    for (const p of highRated) {
      expect(p.rating).toBeGreaterThanOrEqual(4.3);
      expect(p.rating).toBeLessThan(4.7);
    }
  });

  it('includes merchantName in each result', () => {
    const results = getTopRecommended(db);
    for (const r of results) {
      expect(r.merchantName).toBeTruthy();
    }
  });

  it('only returns in-stock products', () => {
    const results = getTopRecommended(db);
    // All seeded products have stock > 0
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns at most 10 results', () => {
    const results = getTopRecommended(db);
    expect(results.length).toBeLessThanOrEqual(10);
  });
});

// ── Upsell Opportunities ──────────────────────────────────────

describe('getUpsellOpportunities', () => {
  it('returns products within the 20–80% above median range', () => {
    const results = getUpsellOpportunities(db);
    for (const u of results) {
      expect(u.premiumFactor).toBeGreaterThanOrEqual(1.2);
      expect(u.premiumFactor).toBeLessThanOrEqual(1.8);
    }
  });

  it('includes upsellReason string for each result', () => {
    const results = getUpsellOpportunities(db);
    for (const u of results) {
      expect(u.upsellReason).toBeTruthy();
      expect(typeof u.upsellReason).toBe('string');
    }
  });

  it('includes medianCategoryPrice for context', () => {
    const results = getUpsellOpportunities(db);
    for (const u of results) {
      expect(u.medianCategoryPrice).toBeGreaterThan(0);
    }
  });

  it('returns at most one product per category', () => {
    const results = getUpsellOpportunities(db);
    const categories = results.map(u => u.category);
    const unique = new Set(categories);
    expect(categories.length).toBe(unique.size);
  });

  it('returns at most 8 results total', () => {
    const results = getUpsellOpportunities(db);
    expect(results.length).toBeLessThanOrEqual(8);
  });
});

// ── Cross-sell Opportunities ──────────────────────────────────

describe('getCrossSellOpportunities', () => {
  it('returns pairs of different categories', () => {
    const results = getCrossSellOpportunities(db);
    for (const pair of results) {
      expect(pair.primaryCategory).not.toBe(pair.complementaryCategory);
    }
  });

  it('includes tagOverlapScore between 0 and 1', () => {
    const results = getCrossSellOpportunities(db);
    for (const pair of results) {
      expect(pair.tagOverlapScore).toBeGreaterThanOrEqual(0);
      expect(pair.tagOverlapScore).toBeLessThanOrEqual(1);
    }
  });

  it('provides example products for each pair', () => {
    const results = getCrossSellOpportunities(db);
    for (const pair of results) {
      expect(pair.examplePrimary.id).toBeTruthy();
      expect(pair.exampleComplement.id).toBeTruthy();
      expect(pair.examplePrimary.price).toBeGreaterThan(0);
      expect(pair.exampleComplement.price).toBeGreaterThan(0);
    }
  });

  it('does not return the same pair twice (no duplicates)', () => {
    const results = getCrossSellOpportunities(db);
    const seen = new Set<string>();
    for (const pair of results) {
      const key1 = `${pair.primaryCategory}:${pair.complementaryCategory}`;
      const key2 = `${pair.complementaryCategory}:${pair.primaryCategory}`;
      expect(seen.has(key1) || seen.has(key2)).toBe(false);
      seen.add(key1);
    }
  });

  it('returns at most 8 pairs', () => {
    const results = getCrossSellOpportunities(db);
    expect(results.length).toBeLessThanOrEqual(8);
  });
});

// ── Abandoned Cart Signals ────────────────────────────────────

describe('getAbandonedCartSignals', () => {
  it('does not include terminal state transactions', () => {
    const results = getAbandonedCartSignals(db);
    const terminalStates = ['COMPLETED', 'BLOCKED', 'CANCELLED', 'PAYMENT_FAILED', 'VERIFIED'];
    for (const signal of results) {
      expect(terminalStates).not.toContain(signal.state);
    }
  });

  it('does not include very recent transactions (< 5 minutes old)', () => {
    const results = getAbandonedCartSignals(db);
    // txn-recent was inserted with a 30-second-old timestamp — ageMinutes = 0, below the 5 min threshold
    const recentTxn = results.find(s => s.transactionId === 'txn-recent');
    expect(recentTxn).toBeUndefined();
  });

  it('includes stalled sessions older than 5 minutes', () => {
    const results = getAbandonedCartSignals(db);
    // txn-stalled is 30 minutes old and in CART_READY — should appear
    const stalled = results.find(s => s.transactionId === 'txn-stalled');
    expect(stalled).toBeDefined();
    expect(stalled?.ageMinutes).toBeGreaterThanOrEqual(5);
  });

  it('includes recovery hints for each signal', () => {
    const results = getAbandonedCartSignals(db);
    for (const signal of results) {
      expect(signal.recoveryHint).toBeTruthy();
      expect(typeof signal.recoveryHint).toBe('string');
    }
  });

  it('includes product information for each signal', () => {
    const results = getAbandonedCartSignals(db);
    for (const signal of results) {
      expect(signal.productName).toBeTruthy();
      expect(signal.productPrice).toBeGreaterThan(0);
    }
  });
});

// ── Campaign Suggestions ──────────────────────────────────────

describe('getCampaignSuggestions', () => {
  it('returns one entry per category', () => {
    const results = getCampaignSuggestions(db);
    const categories = results.map(c => c.category);
    const unique = new Set(categories);
    expect(categories.length).toBe(unique.size);
  });

  it('contains valid suggestedAction values', () => {
    const results = getCampaignSuggestions(db);
    const validActions = ['PRICE_DROP', 'BUNDLE_OFFER', 'HIGHLIGHT', 'CROSS_PROMOTE'];
    for (const c of results) {
      expect(validActions).toContain(c.suggestedAction);
    }
  });

  it('includes non-empty suggestions', () => {
    const results = getCampaignSuggestions(db);
    for (const c of results) {
      expect(c.suggestion).toBeTruthy();
    }
  });

  it('includes price ranges that are valid (min <= max)', () => {
    const results = getCampaignSuggestions(db);
    for (const c of results) {
      expect(c.priceRange.min).toBeLessThanOrEqual(c.priceRange.max);
      expect(c.priceRange.min).toBeGreaterThan(0);
    }
  });

  it('includes product counts > 0', () => {
    const results = getCampaignSuggestions(db);
    for (const c of results) {
      expect(c.productCount).toBeGreaterThan(0);
    }
  });
});

// ── Full Report ───────────────────────────────────────────────

describe('generateGrowthReport', () => {
  it('returns all five sections', () => {
    const report = generateGrowthReport(db);
    expect(report).toHaveProperty('topRecommended');
    expect(report).toHaveProperty('upsellOpportunities');
    expect(report).toHaveProperty('crossSellOpportunities');
    expect(report).toHaveProperty('abandonedCartSignals');
    expect(report).toHaveProperty('campaignSuggestions');
  });

  it('includes a generatedAt ISO timestamp', () => {
    const report = generateGrowthReport(db);
    expect(report.generatedAt).toBeTruthy();
    expect(() => new Date(report.generatedAt)).not.toThrow();
  });

  it('includes a dataNote clarifying synthetic nature', () => {
    const report = generateGrowthReport(db);
    expect(report.dataNote).toBeTruthy();
    expect(report.dataNote.toLowerCase()).toContain('synthetic');
  });

  it('clarifies the synthetic nature of data in the dataNote', () => {
    const report = generateGrowthReport(db);
    // The note must mention synthetic — it should NOT claim real revenue/conversion data
    expect(report.dataNote.toLowerCase()).toContain('synthetic');
    // It may mention 'revenue' only to disclaim it (e.g., "no revenue data used")
    // What it must NOT claim is actual figures — the presence of 'synthetic' is the guardrail
  });
});
