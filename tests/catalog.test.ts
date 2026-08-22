// ============================================================
// Tests — Catalog Search & Filtering
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Database as SqlJsDatabase } from 'sql.js';
import { getTestDb } from '@/db/connection';
import { seedDatabase } from '@/db/seed';
import {
  searchProducts,
  getProductById,
  getMerchantById,
  getAllMerchants,
  getCategories,
  getProductCount,
} from '@/services/catalog';

let db: SqlJsDatabase;

beforeAll(async () => {
  db = await getTestDb();
  seedDatabase(db);
});

afterAll(() => {
  db.close();
});

describe('Catalog — Product Search', () => {
  it('should return all products when no filters are applied', () => {
    const results = searchProducts(db, { limit: 100, offset: 0 });
    expect(results.length).toBe(60);
  });

  it('should filter by category', () => {
    const results = searchProducts(db, { category: 'headphones', limit: 50, offset: 0 });
    expect(results.length).toBe(12);
    for (const p of results) {
      expect(p.category).toBe('headphones');
    }
  });

  it('should filter by max price', () => {
    const results = searchProducts(db, { maxPrice: 2000, limit: 50, offset: 0 });
    for (const p of results) {
      expect(p.price).toBeLessThanOrEqual(2000);
    }
  });

  it('should filter by min price', () => {
    const results = searchProducts(db, { minPrice: 50000, limit: 50, offset: 0 });
    for (const p of results) {
      expect(p.price).toBeGreaterThanOrEqual(50000);
    }
  });

  it('should filter by price range', () => {
    const results = searchProducts(db, { minPrice: 3000, maxPrice: 8000, limit: 50, offset: 0 });
    for (const p of results) {
      expect(p.price).toBeGreaterThanOrEqual(3000);
      expect(p.price).toBeLessThanOrEqual(8000);
    }
  });

  it('should filter by max delivery days', () => {
    const results = searchProducts(db, { maxDeliveryDays: 2, limit: 50, offset: 0 });
    for (const p of results) {
      expect(p.deliveryDays).toBeLessThanOrEqual(2);
    }
  });

  it('should filter by min rating', () => {
    const results = searchProducts(db, { minRating: 4.5, limit: 50, offset: 0 });
    for (const p of results) {
      expect(p.rating).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('should filter by merchant trust tiers', () => {
    const results = searchProducts(db, { merchantTrustTiers: ['PLATINUM'], limit: 50, offset: 0 });
    for (const p of results) {
      expect(p.merchantTrustTier).toBe('PLATINUM');
    }
  });

  it('should filter by text query in name', () => {
    const results = searchProducts(db, { query: 'Sony', limit: 50, offset: 0 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      const matchesName = p.name.toLowerCase().includes('sony');
      const matchesDesc = p.description.toLowerCase().includes('sony');
      const matchesTags = p.tags.some(t => t.toLowerCase().includes('sony'));
      expect(matchesName || matchesDesc || matchesTags).toBe(true);
    }
  });

  it('should filter by tags', () => {
    const results = searchProducts(db, { tags: ['noise-cancelling'], limit: 50, offset: 0 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.tags.some(t => t.toLowerCase().includes('noise-cancelling'))).toBe(true);
    }
  });

  it('should combine multiple filters', () => {
    const results = searchProducts(db, {
      category: 'headphones',
      maxPrice: 8000,
      maxDeliveryDays: 3,
      limit: 50,
      offset: 0,
    });
    for (const p of results) {
      expect(p.category).toBe('headphones');
      expect(p.price).toBeLessThanOrEqual(8000);
      expect(p.deliveryDays).toBeLessThanOrEqual(3);
    }
  });

  it('should respect pagination limit', () => {
    const results = searchProducts(db, { limit: 5, offset: 0 });
    expect(results.length).toBe(5);
  });

  it('should respect pagination offset', () => {
    const page1 = searchProducts(db, { limit: 5, offset: 0 });
    const page2 = searchProducts(db, { limit: 5, offset: 5 });
    expect(page1[0].id).not.toBe(page2[0].id);
  });

  it('should sort by rating desc, then price asc', () => {
    const results = searchProducts(db, { category: 'headphones', limit: 50, offset: 0 });
    for (let i = 1; i < results.length; i++) {
      if (results[i].rating === results[i - 1].rating) {
        expect(results[i].price).toBeGreaterThanOrEqual(results[i - 1].price);
      } else {
        expect(results[i].rating).toBeLessThanOrEqual(results[i - 1].rating);
      }
    }
  });

  it('should filter in-stock products', () => {
    const results = searchProducts(db, { inStock: true, limit: 100, offset: 0 });
    for (const p of results) {
      expect(p.stock).toBeGreaterThan(0);
    }
  });
});

describe('Catalog — Product Retrieval', () => {
  it('should get a product by ID', () => {
    const product = getProductById(db, 'prod-001');
    expect(product).not.toBeNull();
    expect(product!.name).toBe('Sony WH-1000XM5');
    expect(product!.price).toBe(24990);
  });

  it('should return null for non-existent product', () => {
    const product = getProductById(db, 'prod-999');
    expect(product).toBeNull();
  });

  it('should parse attributes as JSON', () => {
    const product = getProductById(db, 'prod-001');
    expect(product!.attributes).toEqual(expect.objectContaining({ type: 'over-ear' }));
  });

  it('should parse tags as JSON array', () => {
    const product = getProductById(db, 'prod-001');
    expect(Array.isArray(product!.tags)).toBe(true);
    expect(product!.tags).toContain('noise-cancelling');
  });
});

describe('Catalog — Merchant Retrieval', () => {
  it('should get a merchant by ID', () => {
    const merchant = getMerchantById(db, 'merch-001');
    expect(merchant).not.toBeNull();
    expect(merchant!.name).toBe('SoundWave Electronics');
    expect(merchant!.trustTier).toBe('PLATINUM');
  });

  it('should return null for non-existent merchant', () => {
    const merchant = getMerchantById(db, 'merch-999');
    expect(merchant).toBeNull();
  });

  it('should get all merchants', () => {
    const merchants = getAllMerchants(db);
    expect(merchants.length).toBe(6);
  });
});

describe('Catalog — Metadata', () => {
  it('should return all categories', () => {
    const categories = getCategories(db);
    expect(categories).toContain('headphones');
    expect(categories).toContain('laptops');
    expect(categories).toContain('smartphones');
    expect(categories).toContain('books');
    expect(categories).toContain('fitness');
    expect(categories).toContain('home-kitchen');
    expect(categories).toContain('accessories');
  });

  it('should return correct product count', () => {
    const count = getProductCount(db);
    expect(count).toBe(60);
  });
});
