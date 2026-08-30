// ============================================================
// Merchant Catalog Service — Phase 10E
// Allows authenticated merchants to manage their own products.
// All write operations enforce ownership via merchant_catalog_id.
// Pure DB functions — no LLM, no side effects beyond SQLite.
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Database as SqlJsDatabase } from 'sql.js';
import { saveDb } from '@/db/connection';
import type { Product } from '@/types/schemas';
import type { ProductCreate, ProductUpdate } from '@/types/schemas';

// ─────────────────────────────────────────────────────────────
// Error
// ─────────────────────────────────────────────────────────────

export class MerchantCatalogError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'MerchantCatalogError';
  }
}

// ─────────────────────────────────────────────────────────────
// Catalog Merchant Linking
// ─────────────────────────────────────────────────────────────

/**
 * Gets the existing catalog merchant ID for a user, or creates a new
 * `merchants` table entry from their shop profile and saves the link.
 *
 * This is called lazily on first product creation — no pre-provisioning needed.
 */
export function getOrCreateCatalogMerchant(
  db: SqlJsDatabase,
  userId: string,
): string {
  // Check if already linked
  const existing = db.exec(
    `SELECT merchant_catalog_id, shop_name, trust_tier FROM merchant_profiles WHERE user_id = ?`,
    [userId],
  );

  if (!existing[0]?.values?.length) {
    throw new MerchantCatalogError('NOT_FOUND', 'Merchant profile not found');
  }

  const [catalogId, shopName, trustTier] = existing[0].values[0] as (string | null)[];

  if (catalogId) return catalogId;

  // Create a new catalog merchant entry
  const newMerchantId = uuidv4();
  const now = new Date().toISOString();

  db.run(
    `INSERT INTO merchants (id, name, trust_tier, description, policies, delivery_regions, payment_capabilities, business_rules, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newMerchantId, shopName ?? 'Unnamed Shop', trustTier ?? 'UNRATED', null, '[]', '[]', '[]', '{}', now],
  );

  // Link the catalog merchant to the auth profile
  db.run(
    `UPDATE merchant_profiles SET merchant_catalog_id = ? WHERE user_id = ?`,
    [newMerchantId, userId],
  );

  saveDb();
  return newMerchantId;
}

/**
 * Returns the merchant_catalog_id for a user, or null if not yet linked.
 */
export function getMerchantCatalogId(
  db: SqlJsDatabase,
  userId: string,
): string | null {
  const result = db.exec(
    `SELECT merchant_catalog_id FROM merchant_profiles WHERE user_id = ?`,
    [userId],
  );
  const value = result[0]?.values?.[0]?.[0];
  return value ? String(value) : null;
}

// ─────────────────────────────────────────────────────────────
// Ownership
// ─────────────────────────────────────────────────────────────

/**
 * Verifies that `productId` belongs to `merchantCatalogId`.
 * Throws MerchantCatalogError(FORBIDDEN) if not owned.
 * Throws MerchantCatalogError(NOT_FOUND) if product does not exist.
 */
export function assertProductOwnership(
  db: SqlJsDatabase,
  productId: string,
  merchantCatalogId: string,
): void {
  const result = db.exec(
    `SELECT merchant_id FROM products WHERE id = ?`,
    [productId],
  );

  if (!result[0]?.values?.length) {
    throw new MerchantCatalogError('NOT_FOUND', `Product not found: ${productId}`);
  }

  const actualMerchantId = String(result[0].values[0][0]);
  if (actualMerchantId !== merchantCatalogId) {
    throw new MerchantCatalogError('FORBIDDEN', 'You do not own this product');
  }
}

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────

/**
 * Get all products belonging to this merchant's catalog entry.
 * Returns empty array if merchant has no catalog entry yet.
 */
export function getProductsByMerchantCatalogId(
  db: SqlJsDatabase,
  merchantCatalogId: string,
  limit = 50,
  offset = 0,
): Product[] {
  const stmt = db.prepare(
    `SELECT id, merchant_id, name, description, category,
            price, currency, stock, rating, delivery_days,
            merchant_trust_tier, attributes, tags, image_url, availability, offer_eligibility, created_at
     FROM products
     WHERE merchant_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  );
  stmt.bind([merchantCatalogId, limit, offset]);

  const results: Product[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    results.push(rowToProduct(row));
  }
  stmt.free();
  return results;
}

/**
 * Count products for a merchant catalog ID.
 */
export function countProductsByMerchantCatalogId(
  db: SqlJsDatabase,
  merchantCatalogId: string,
): number {
  const result = db.exec(
    `SELECT COUNT(*) as cnt FROM products WHERE merchant_id = ?`,
    [merchantCatalogId],
  );
  return Number(result[0]?.values?.[0]?.[0] ?? 0);
}

// ─────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────

/**
 * Create a new product under the merchant's catalog entry.
 * Auto-creates the catalog merchant row if it doesn't exist yet.
 */
export function createMerchantProduct(
  db: SqlJsDatabase,
  userId: string,
  data: ProductCreate,
): Product {
  const merchantCatalogId = getOrCreateCatalogMerchant(db, userId);

  // Fetch trust tier for denormalization
  const tierResult = db.exec(
    `SELECT trust_tier FROM merchants WHERE id = ?`,
    [merchantCatalogId],
  );
  const trustTier = String(tierResult[0]?.values?.[0]?.[0] ?? 'UNRATED');

  const productId = uuidv4();
  const now = new Date().toISOString();
  const availability = (data.stock ?? 0) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';

  db.run(
    `INSERT INTO products
       (id, merchant_id, name, description, category, price, currency,
        stock, rating, delivery_days, merchant_trust_tier, attributes,
        tags, image_url, availability, offer_eligibility, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      productId,
      merchantCatalogId,
      data.name,
      data.description,
      data.category,
      data.price,
      data.currency ?? 'INR',
      data.stock ?? 0,
      0, // new products start unrated
      data.deliveryDays,
      trustTier,
      JSON.stringify(data.attributes ?? {}),
      JSON.stringify(data.tags ?? []),
      data.imageUrl || null,
      availability,
      '[]',
      now,
    ],
  );

  saveDb();

  return {
    id: productId,
    merchantId: merchantCatalogId,
    name: data.name,
    description: data.description,
    category: data.category,
    price: data.price,
    currency: data.currency ?? 'INR',
    stock: data.stock ?? 0,
    rating: 0,
    deliveryDays: data.deliveryDays,
    merchantTrustTier: trustTier as Product['merchantTrustTier'],
    attributes: data.attributes ?? {},
    tags: data.tags ?? [],
    imageUrl: data.imageUrl || undefined,
    availability,
    offerEligibility: [],
    createdAt: now,
  };
}

/**
 * Update fields on a product. Enforces ownership before writing.
 */
export function updateMerchantProduct(
  db: SqlJsDatabase,
  userId: string,
  productId: string,
  data: ProductUpdate,
): Product {
  const merchantCatalogId = getMerchantCatalogId(db, userId);
  if (!merchantCatalogId) {
    throw new MerchantCatalogError('FORBIDDEN', 'No catalog linked to this merchant account');
  }

  assertProductOwnership(db, productId, merchantCatalogId);

  // Fetch current product state
  const current = db.exec(
    `SELECT stock, price, name, description, category, currency, delivery_days, attributes, tags, image_url, availability
     FROM products WHERE id = ?`,
    [productId],
  );

  if (!current[0]?.values?.length) {
    throw new MerchantCatalogError('NOT_FOUND', 'Product not found');
  }

  const [
    currentStock, currentPrice, currentName, currentDesc, currentCat,
    currentCurrency, currentDelivery, currentAttrs, currentTags,
    currentImageUrl, currentAvailability,
  ] = current[0].values[0] as (string | number | null)[];

  // Build updated values
  const newStock = data.stock !== undefined ? data.stock : Number(currentStock);
  const newAvailability = (data.active === false)
    ? 'OUT_OF_STOCK'
    : newStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';

  db.run(
    `UPDATE products SET
       name = ?, description = ?, category = ?, price = ?, currency = ?,
       stock = ?, delivery_days = ?, attributes = ?, tags = ?,
       image_url = ?, availability = ?
     WHERE id = ?`,
    [
      data.name ?? currentName,
      data.description ?? currentDesc,
      data.category ?? currentCat,
      data.price ?? currentPrice,
      data.currency ?? currentCurrency,
      data.active === false ? 0 : newStock,
      data.deliveryDays ?? currentDelivery,
      data.attributes !== undefined ? JSON.stringify(data.attributes) : currentAttrs,
      data.tags !== undefined ? JSON.stringify(data.tags) : currentTags,
      data.imageUrl !== undefined ? (data.imageUrl || null) : currentImageUrl,
      newAvailability,
      productId,
    ],
  );

  saveDb();

  // Return updated product
  const updated = db.exec(
    `SELECT id, merchant_id, name, description, category, price, currency, stock,
            rating, delivery_days, merchant_trust_tier, attributes, tags,
            image_url, availability, offer_eligibility, created_at
     FROM products WHERE id = ?`,
    [productId],
  );

  const row = updated[0]?.values?.[0];
  if (!row) throw new MerchantCatalogError('NOT_FOUND', 'Product not found after update');

  return rowToProduct({
    id: row[0], merchant_id: row[1], name: row[2], description: row[3],
    category: row[4], price: row[5], currency: row[6], stock: row[7],
    rating: row[8], delivery_days: row[9], merchant_trust_tier: row[10],
    attributes: row[11], tags: row[12], image_url: row[13],
    availability: row[14], offer_eligibility: row[15], created_at: row[16],
  } as Record<string, unknown>);
}

/**
 * Deactivate a product: sets stock=0 and availability=OUT_OF_STOCK.
 * Product remains in the catalog but is not discoverable (stock=0 filter).
 */
export function deactivateMerchantProduct(
  db: SqlJsDatabase,
  userId: string,
  productId: string,
): void {
  const merchantCatalogId = getMerchantCatalogId(db, userId);
  if (!merchantCatalogId) {
    throw new MerchantCatalogError('FORBIDDEN', 'No catalog linked to this merchant account');
  }

  assertProductOwnership(db, productId, merchantCatalogId);

  db.run(
    `UPDATE products SET stock = 0, availability = 'OUT_OF_STOCK' WHERE id = ?`,
    [productId],
  );

  saveDb();
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

function rowToProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    merchantId: row.merchant_id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    category: row.category as string,
    price: row.price as number,
    currency: (row.currency as string) ?? 'INR',
    stock: row.stock as number,
    rating: row.rating as number,
    deliveryDays: row.delivery_days as number,
    merchantTrustTier: (row.merchant_trust_tier as Product['merchantTrustTier']) ?? 'UNRATED',
    attributes: typeof row.attributes === 'string' ? JSON.parse(row.attributes) : {},
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : [],
    imageUrl: (row.image_url as string) || undefined,
    availability: (row.availability as Product['availability']) ?? 'IN_STOCK',
    offerEligibility: typeof row.offer_eligibility === 'string' ? JSON.parse(row.offer_eligibility) : [],
    createdAt: row.created_at as string,
  };
}
