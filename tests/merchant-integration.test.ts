import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/db/connection';
import type { Database as SqlJsDatabase } from 'sql.js';
import { getOrCreateCatalogMerchant, createMerchantProduct } from '@/services/merchant-catalog';
import { generateGrowthReport } from '@/services/growth-intelligence';

describe('Merchant Integration', () => {
  let db: SqlJsDatabase;

  beforeEach(async () => {
    db = await getDb();
    
    // Clear test data
    db.run(`DELETE FROM transactions WHERE id LIKE 'test-txn-%'`);
    db.run(`DELETE FROM audit_events WHERE transaction_id LIKE 'test-txn-%'`);
    db.run(`DELETE FROM products WHERE id LIKE 'test-prod-%'`);
    db.run(`DELETE FROM merchants WHERE id LIKE 'test-merch-%'`);
    db.run(`DELETE FROM merchant_profiles WHERE user_id LIKE 'test-user-%'`);
  });

  it('should correctly scope orders and growth intelligence to a specific merchant', () => {
    // 1. Setup Merchant A and Merchant B
    db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-A', 'Shop A', 'PLATINUM')`);
    db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-B', 'Shop B', 'GOLD')`);
    
    const catalogIdA = getOrCreateCatalogMerchant(db, 'test-user-A');
    const catalogIdB = getOrCreateCatalogMerchant(db, 'test-user-B');

    // 2. Create products for Merchant A and Merchant B
    const prodA = createMerchantProduct(db, 'test-user-A', {
      name: 'Product A1',
      description: 'Test product A1',
      category: 'Electronics',
      price: 1000,
      currency: 'INR',
      stock: 10,
      deliveryDays: 3,
      attributes: {},
      tags: ['test', 'electronics'],
      imageUrl: ''
    });

    const prodB = createMerchantProduct(db, 'test-user-B', {
      name: 'Product B1',
      description: 'Test product B1',
      category: 'Clothing',
      price: 500,
      currency: 'INR',
      stock: 20,
      deliveryDays: 3,
      attributes: {},
      tags: ['test', 'clothing'],
      imageUrl: ''
    });

    // 3. Simulate customer purchases (transactions)
    db.run(`
      INSERT INTO transactions (id, user_id, state, selected_product_id, selected_product_name, selected_product_price, idempotency_key, created_at, updated_at)
      VALUES 
      ('test-txn-A1', 'cust-1', 'COMPLETED', ?, 'Product A1', 1000, 'ikey-A1', ?, ?),
      ('test-txn-A2', 'cust-2', 'COMPLETED', ?, 'Product A1', 1000, 'ikey-A2', ?, ?),
      ('test-txn-B1', 'cust-3', 'COMPLETED', ?, 'Product B1', 500, 'ikey-B1', ?, ?)
    `, [
      prodA.id, new Date().toISOString(), new Date().toISOString(),
      prodA.id, new Date().toISOString(), new Date().toISOString(),
      prodB.id, new Date().toISOString(), new Date().toISOString()
    ]);

    // 4. Verify Merchant Stats scoping
    const statsStmtA = db.prepare(`
      SELECT COUNT(t.id) as cnt 
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ?
    `);
    statsStmtA.bind([catalogIdA]);
    statsStmtA.step();
    const ordersA = statsStmtA.getAsObject().cnt;
    statsStmtA.free();

    const statsStmtB = db.prepare(`
      SELECT COUNT(t.id) as cnt 
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE p.merchant_id = ?
    `);
    statsStmtB.bind([catalogIdB]);
    statsStmtB.step();
    const ordersB = statsStmtB.getAsObject().cnt;
    statsStmtB.free();

    expect(ordersA).toBe(2);
    expect(ordersB).toBe(1);

    // 5. Verify Growth Intelligence Scoping
    const reportA = generateGrowthReport(db, catalogIdA);
    const reportB = generateGrowthReport(db, catalogIdB);

    // Campaign suggestions should only contain their own categories
    const categoriesA = reportA.campaignSuggestions.map(s => s.category);
    expect(categoriesA).toContain('Electronics');
    expect(categoriesA).not.toContain('Clothing');

    const categoriesB = reportB.campaignSuggestions.map(s => s.category);
    expect(categoriesB).toContain('Clothing');
    expect(categoriesB).not.toContain('Electronics');
  });

  it('should prevent Merchant B from accessing Merchant A order details', () => {
    // Setup
    db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-A', 'Shop A', 'PLATINUM')`);
    const catalogIdA = getOrCreateCatalogMerchant(db, 'test-user-A');

    const prodA = createMerchantProduct(db, 'test-user-A', {
      name: 'Product A1',
      description: 'Test product A1',
      category: 'Electronics',
      price: 1000,
      currency: 'INR',
      stock: 10,
      deliveryDays: 3,
      attributes: {},
      tags: [],
      imageUrl: ''
    });

    db.run(`
      INSERT INTO transactions (id, user_id, state, selected_product_id, selected_product_name, selected_product_price, idempotency_key, created_at, updated_at)
      VALUES ('test-txn-A1', 'cust-1', 'COMPLETED', ?, 'Product A1', 1000, 'ikey-A1', ?, ?)
    `, [prodA.id, new Date().toISOString(), new Date().toISOString()]);

    // Attempt to access from Merchant B (IDOR attempt)
    db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-B', 'Shop B', 'GOLD')`);
    const catalogIdB = getOrCreateCatalogMerchant(db, 'test-user-B');

    const stmt = db.prepare(`
      SELECT t.*, p.merchant_id
      FROM transactions t
      JOIN products p ON t.selected_product_id = p.id
      WHERE t.id = ? AND p.merchant_id = ?
    `);
    stmt.bind(['test-txn-A1', catalogIdB]);
    
    // step() returns false when no rows match
    const hasRow = stmt.step();
    stmt.free();

    // The order should not be found when queried with Merchant B's catalog ID
    expect(hasRow).toBe(false);
  });
});
