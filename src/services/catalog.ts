// ============================================================
// Catalog Service — Product search, filtering, and retrieval
// ============================================================

import type { Database as SqlJsDatabase } from 'sql.js';
import type { Product, Merchant, CatalogSearchParams } from '@/types/schemas';

/**
 * Search products with filtering and pagination.
 */
export function searchProducts(
  db: SqlJsDatabase,
  params: CatalogSearchParams,
): Product[] {
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (params.category) {
    conditions.push('LOWER(p.category) = LOWER(?)');
    bindings.push(params.category);
  }

  if (params.minPrice !== undefined) {
    conditions.push('p.price >= ?');
    bindings.push(params.minPrice);
  }

  if (params.maxPrice !== undefined) {
    conditions.push('p.price <= ?');
    bindings.push(params.maxPrice);
  }

  if (params.maxDeliveryDays !== undefined) {
    conditions.push('p.delivery_days <= ?');
    bindings.push(params.maxDeliveryDays);
  }

  if (params.minRating !== undefined) {
    conditions.push('p.rating >= ?');
    bindings.push(params.minRating);
  }

  if (params.inStock) {
    conditions.push('p.stock > 0');
  }

  if (params.merchantTrustTiers && params.merchantTrustTiers.length > 0) {
    const placeholders = params.merchantTrustTiers.map(() => '?').join(', ');
    conditions.push(`p.merchant_trust_tier IN (${placeholders})`);
    bindings.push(...params.merchantTrustTiers);
  }

  if (params.query) {
    conditions.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.tags) LIKE ?)');
    const searchTerm = `%${params.query.toLowerCase()}%`;
    bindings.push(searchTerm, searchTerm, searchTerm);
  }

  if (params.tags && params.tags.length > 0) {
    for (const tag of params.tags) {
      conditions.push('LOWER(p.tags) LIKE ?');
      bindings.push(`%${tag.toLowerCase()}%`);
    }
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const sql = `
    SELECT p.id, p.merchant_id, p.name, p.description, p.category,
           p.price, p.currency, p.stock, p.rating, p.delivery_days,
           p.merchant_trust_tier, p.attributes, p.tags, p.image_url, p.created_at
    FROM products p
    ${whereClause}
    ORDER BY p.rating DESC, p.price ASC
    LIMIT ? OFFSET ?
  `;

  bindings.push(params.limit ?? 20, params.offset ?? 0);

  const stmt = db.prepare(sql);
  stmt.bind(bindings);

  const results: Product[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    results.push(rowToProduct(row));
  }
  stmt.free();

  return results;
}

/**
 * Get a product by ID.
 */
export function getProductById(
  db: SqlJsDatabase,
  productId: string,
): Product | null {
  const stmt = db.prepare(
    `SELECT id, merchant_id, name, description, category,
            price, currency, stock, rating, delivery_days,
            merchant_trust_tier, attributes, tags, image_url, created_at
     FROM products WHERE id = ?`,
  );
  stmt.bind([productId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();
  return rowToProduct(row);
}

/**
 * Get a merchant by ID.
 */
export function getMerchantById(
  db: SqlJsDatabase,
  merchantId: string,
): Merchant | null {
  const stmt = db.prepare(
    `SELECT id, name, trust_tier, description, created_at
     FROM merchants WHERE id = ?`,
  );
  stmt.bind([merchantId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as Record<string, unknown>;
  stmt.free();

  return {
    id: row.id as string,
    name: row.name as string,
    trustTier: row.trust_tier as Merchant['trustTier'],
    description: (row.description as string) || undefined,
    createdAt: row.created_at as string,
  };
}

/**
 * Get all merchants.
 */
export function getAllMerchants(db: SqlJsDatabase): Merchant[] {
  const stmt = db.prepare(
    `SELECT id, name, trust_tier, description, created_at FROM merchants ORDER BY name`,
  );

  const results: Merchant[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    results.push({
      id: row.id as string,
      name: row.name as string,
      trustTier: row.trust_tier as Merchant['trustTier'],
      description: (row.description as string) || undefined,
      createdAt: row.created_at as string,
    });
  }
  stmt.free();

  return results;
}

/**
 * Get all distinct categories.
 */
export function getCategories(db: SqlJsDatabase): string[] {
  const stmt = db.prepare(`SELECT DISTINCT category FROM products ORDER BY category`);
  const categories: string[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { category: string };
    categories.push(row.category);
  }
  stmt.free();
  return categories;
}

/**
 * Get product count.
 */
export function getProductCount(db: SqlJsDatabase): number {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM products`);
  stmt.step();
  const row = stmt.getAsObject() as { count: number };
  stmt.free();
  return row.count;
}

// ── Helpers ──────────────────────────────────────────────────

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    name: row.name as string,
    description: (row.description as string) || '',
    category: row.category as string,
    price: row.price as number,
    currency: (row.currency as string) || 'INR',
    stock: row.stock as number,
    rating: row.rating as number,
    deliveryDays: row.delivery_days as number,
    merchantTrustTier: row.merchant_trust_tier as Product['merchantTrustTier'],
    attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : {},
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : [],
    imageUrl: (row.image_url as string) || undefined,
    createdAt: row.created_at as string,
  };
}
