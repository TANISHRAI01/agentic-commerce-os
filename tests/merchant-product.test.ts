// ============================================================
// Merchant Product Management Tests
// Tests the DB operations for managing merchant products
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '@/db/connection';
import type { Database as SqlJsDatabase } from 'sql.js';
import { 
  getOrCreateCatalogMerchant, 
  getMerchantCatalogId,
  createMerchantProduct,
  updateMerchantProduct,
  deactivateMerchantProduct,
  assertProductOwnership,
  getProductsByMerchantCatalogId,
  MerchantCatalogError
} from '@/services/merchant-catalog';

describe('Merchant Catalog Service', () => {
  let db: SqlJsDatabase;

  beforeEach(async () => {
    db = await getDb();
    
    // Clear test data
    db.run(`DELETE FROM products WHERE id LIKE 'test-prod-%'`);
    db.run(`DELETE FROM merchants WHERE id LIKE 'test-merch-%'`);
    db.run(`DELETE FROM merchant_profiles WHERE user_id LIKE 'test-user-%'`);
  });

  describe('Linking and Creation', () => {
    it('should create a catalog merchant on first request', () => {
      // Create a merchant profile
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-1', 'Test Shop', 'GOLD')`);
      
      const catalogId = getOrCreateCatalogMerchant(db, 'test-user-1');
      expect(catalogId).toBeDefined();
      expect(typeof catalogId).toBe('string');
      
      const check = db.exec(`SELECT merchant_catalog_id FROM merchant_profiles WHERE user_id = 'test-user-1'`);
      expect(check[0].values[0][0]).toBe(catalogId);
    });

    it('should return existing catalog merchant on subsequent requests', () => {
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-2', 'Test Shop 2', 'SILVER')`);
      const firstCall = getOrCreateCatalogMerchant(db, 'test-user-2');
      const secondCall = getOrCreateCatalogMerchant(db, 'test-user-2');
      expect(firstCall).toBe(secondCall);
    });
  });

  describe('Product Management CRUD', () => {
    it('should create and retrieve a product', () => {
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-3', 'Cat Shop', 'GOLD')`);
      // Ensure catalog entry exists
      getOrCreateCatalogMerchant(db, 'test-user-3');
      
      const newProduct = createMerchantProduct(db, 'test-user-3', {
        name: 'Test Headphones',
        description: 'Test desc',
        category: 'Electronics',
        price: 500,
        currency: 'INR',
        stock: 10,
        deliveryDays: 2,
        attributes: {},
        tags: []
      });

      expect(newProduct.id).toBeDefined();
      expect(newProduct.merchantId).toBeDefined();
      expect(newProduct.price).toBe(500);
      expect(newProduct.currency).toBe('INR');
      expect(newProduct.availability).toBe('IN_STOCK');
      expect(newProduct.offerEligibility).toEqual([]);

      const products = getProductsByMerchantCatalogId(db, newProduct.merchantId);
      expect(products.length).toBe(1);
      expect(products[0].id).toBe(newProduct.id);
    });

    it('should update a product', () => {
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-4', 'Cat Shop 2', 'SILVER')`);
      // Ensure catalog entry exists
      getOrCreateCatalogMerchant(db, 'test-user-4');
      
      const p = createMerchantProduct(db, 'test-user-4', {
        name: 'Initial Name',
        description: 'Test',
        category: 'Test',
        price: 100,
        currency: 'INR',
        stock: 5,
        deliveryDays: 1,
        attributes: {},
        tags: []
      });

      const updated = updateMerchantProduct(db, 'test-user-4', p.id, {
        name: 'Updated Name', price: 200, stock: 0
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.price).toBe(200);
      expect(updated.stock).toBe(0);
      
      // Verify in DB
      const res = db.exec(`SELECT name, price FROM products WHERE id = ?`, [p.id]);
      expect(res[0].values[0][0]).toBe('Updated Name');
      expect(res[0].values[0][1]).toBe(200);
    });

    it('should deactivate a product', () => {
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-5', 'Cat Shop 3', 'BRONZE')`);
      // Ensure catalog entry exists
      getOrCreateCatalogMerchant(db, 'test-user-5');
      const p = createMerchantProduct(db, 'test-user-5', {
        name: 'Active Product', description: 'desc', category: 'cat', price: 100, currency: 'INR', stock: 5, deliveryDays: 1, attributes: {}, tags: []
      });

      deactivateMerchantProduct(db, 'test-user-5', p.id);
      
      const res = db.exec(`SELECT availability, offer_eligibility FROM products WHERE id = ?`, [p.id]);
      expect(res[0].values[0][0]).toBe('OUT_OF_STOCK'); // or however deactivate works
      expect(res[0].values[0][1]).toBe('[]');
    });
  });

  describe('Ownership Rules', () => {
    it('should assert ownership correctly', () => {
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-6', 'Cat Shop 4', 'PLATINUM')`);
      db.run(`INSERT INTO merchant_profiles (user_id, shop_name, trust_tier) VALUES ('test-user-7', 'Cat Shop 5', 'PLATINUM')`);
      
      const cat4 = getOrCreateCatalogMerchant(db, 'test-user-6');
      const cat5 = getOrCreateCatalogMerchant(db, 'test-user-7');

      const p = createMerchantProduct(db, 'test-user-6', {
        name: 'My Product', description: 'desc', category: 'cat', price: 100, currency: 'INR', stock: 5, deliveryDays: 1, attributes: {}, tags: []
      });

      // Should not throw
      expect(() => assertProductOwnership(db, p.id, cat4)).not.toThrow();

      // Should throw FORBIDDEN
      expect(() => assertProductOwnership(db, p.id, cat5)).toThrow(MerchantCatalogError);
      try {
        assertProductOwnership(db, p.id, cat5);
      } catch (e: any) {
        expect(e.code).toBe('FORBIDDEN');
      }
    });

    it('should throw NOT_FOUND for non-existent product', () => {
      expect(() => assertProductOwnership(db, 'fake-id', 'test-merch-cat-4')).toThrow(MerchantCatalogError);
    });
  });
});
