// ============================================================
// Growth Intelligence Service — Deterministic, no LLM
// Derives growth signals from catalog and transaction data
// All data is synthetic / heuristic. No revenue claims.
// ============================================================

import type { Database as SqlJsDatabase } from 'sql.js';

// ── Output Types ──────────────────────────────────────────────

export interface TopRecommendedProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  merchantName: string;
  merchantTrustTier: string;
  /** Synthetic signal: products with rating >= 4.5 are flagged as top picks */
  signalLabel: 'TOP_PICK' | 'HIGH_RATED' | 'POPULAR';
}

export interface UpsellOpportunity {
  id: string;
  name: string;
  category: string;
  price: number;
  medianCategoryPrice: number;
  premiumFactor: number; // price / median, e.g. 1.35 = 35% above median
  rating: number;
  merchantTrustTier: string;
  upsellReason: string;
}

export interface CrossSellPair {
  primaryCategory: string;
  complementaryCategory: string;
  tagOverlapScore: number; // 0–1
  examplePrimary: { id: string; name: string; price: number };
  exampleComplement: { id: string; name: string; price: number };
  suggestion: string;
}

export interface AbandonedCartSignal {
  transactionId: string;
  productName: string;
  productPrice: number;
  state: string;
  ageMinutes: number;
  /** Synthetic: suggests buyer may have dropped off */
  recoveryHint: string;
}

export interface CampaignSuggestion {
  category: string;
  productCount: number;
  avgRating: number;
  priceRange: { min: number; max: number };
  suggestion: string;
  suggestedAction: 'PRICE_DROP' | 'BUNDLE_OFFER' | 'HIGHLIGHT' | 'CROSS_PROMOTE';
}

export interface GrowthIntelligenceReport {
  topRecommended: TopRecommendedProduct[];
  upsellOpportunities: UpsellOpportunity[];
  crossSellOpportunities: CrossSellPair[];
  abandonedCartSignals: AbandonedCartSignal[];
  campaignSuggestions: CampaignSuggestion[];
  generatedAt: string;
  dataNote: string;
}

// ── Helper row types ──────────────────────────────────────────

interface ProductRow {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  merchant_name: string;
  merchant_trust_tier: string;
  tags: string;
}

interface TxnRow {
  id: string;
  state: string;
  selected_product_name: string;
  selected_product_price: number;
  created_at: string;
}

// ── Top Recommended Products ──────────────────────────────────

/**
 * Returns the top-rated products across the catalog.
 * Signal is derived from rating (heuristic proxy for recommendation frequency).
 */
export function getTopRecommended(db: SqlJsDatabase, merchantCatalogId?: string): TopRecommendedProduct[] {
  const whereClause = merchantCatalogId ? `WHERE p.stock > 0 AND p.merchant_id = ?` : `WHERE p.stock > 0`;
  const params = merchantCatalogId ? [merchantCatalogId] : [];
  const stmt = db.prepare(`
    SELECT p.id, p.name, p.category, p.price, p.rating,
           m.name as merchant_name, p.merchant_trust_tier, p.tags
    FROM products p
    JOIN merchants m ON p.merchant_id = m.id
    ${whereClause}
    ORDER BY p.rating DESC, p.price ASC
    LIMIT 10
  `);
  stmt.bind(params);

  const results: TopRecommendedProduct[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as ProductRow;
    let signalLabel: TopRecommendedProduct['signalLabel'] = 'POPULAR';
    if (row.rating >= 4.7) signalLabel = 'TOP_PICK';
    else if (row.rating >= 4.3) signalLabel = 'HIGH_RATED';

    results.push({
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      rating: row.rating,
      merchantName: row.merchant_name,
      merchantTrustTier: row.merchant_trust_tier,
      signalLabel,
    });
  }
  stmt.free();
  return results;
}

// ── Upsell Opportunities ──────────────────────────────────────

/**
 * Returns products priced 20–80% above their category median.
 * These are strong upsell candidates when paired with cheaper alternatives.
 */
export function getUpsellOpportunities(db: SqlJsDatabase, merchantCatalogId?: string): UpsellOpportunity[] {
  const medianWhere = merchantCatalogId ? `WHERE stock > 0 AND merchant_id = ?` : `WHERE stock > 0`;
  const params = merchantCatalogId ? [merchantCatalogId] : [];
  
  // Get category medians
  const medianStmt = db.prepare(`
    SELECT category, AVG(price) as avg_price
    FROM products
    ${medianWhere}
    GROUP BY category
  `);
  medianStmt.bind(params);

  const categoryMedians: Record<string, number> = {};
  while (medianStmt.step()) {
    const row = medianStmt.getAsObject() as unknown as { category: string; avg_price: number };
    categoryMedians[row.category] = row.avg_price;
  }
  medianStmt.free();

  const prodWhere = merchantCatalogId ? `WHERE p.stock > 0 AND p.rating >= 4.0 AND p.merchant_id = ?` : `WHERE p.stock > 0 AND p.rating >= 4.0`;
  const stmt = db.prepare(`
    SELECT p.id, p.name, p.category, p.price, p.rating, p.merchant_trust_tier, p.tags
    FROM products p
    ${prodWhere}
    ORDER BY p.category, p.price DESC
    LIMIT 30
  `);
  stmt.bind(params);

  const results: UpsellOpportunity[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as ProductRow;
    const median = categoryMedians[row.category] ?? 0;
    if (median === 0) continue;
    const factor = row.price / median;
    // Only include products 20–80% above category average (sweet-spot upsell range)
    if (factor < 1.2 || factor > 1.8) continue;

    const pct = Math.round((factor - 1) * 100);
    results.push({
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      medianCategoryPrice: Math.round(median),
      premiumFactor: Math.round(factor * 100) / 100,
      rating: row.rating,
      merchantTrustTier: row.merchant_trust_tier,
      upsellReason: `${pct}% above category average — rated ${row.rating}/5`,
    });
  }
  stmt.free();

  // Deduplicate per category — keep best-rated per category, max 8 total
  const seen = new Set<string>();
  return results
    .sort((a, b) => b.rating - a.rating)
    .filter(u => {
      if (seen.has(u.category)) return false;
      seen.add(u.category);
      return true;
    })
    .slice(0, 8);
}

// ── Cross-sell Opportunities ──────────────────────────────────

/**
 * Finds category pairs that share tag overlap — strong cross-sell signal.
 * Returns top pairings with example products.
 */
export function getCrossSellOpportunities(db: SqlJsDatabase, merchantCatalogId?: string): CrossSellPair[] {
  const whereClause = merchantCatalogId ? `WHERE p.stock > 0 AND p.merchant_id = ?` : `WHERE p.stock > 0`;
  const params = merchantCatalogId ? [merchantCatalogId] : [];
  const stmt = db.prepare(`
    SELECT p.id, p.name, p.category, p.price, p.tags
    FROM products p
    ${whereClause}
    ORDER BY p.rating DESC
    LIMIT 60
  `);
  stmt.bind(params);

  interface ProdInfo { id: string; name: string; category: string; price: number; tags: string[] }
  const products: ProdInfo[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as { id: string; name: string; category: string; price: number; tags: string };
    products.push({
      id: row.id,
      name: row.name,
      category: row.category,
      price: row.price,
      tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : [],
    });
  }
  stmt.free();

  // Group by category
  const byCategory: Record<string, ProdInfo[]> = {};
  for (const p of products) {
    if (!byCategory[p.category]) byCategory[p.category] = [];
    byCategory[p.category].push(p);
  }

  const categories = Object.keys(byCategory);
  const pairs: CrossSellPair[] = [];

  // Static complementary category mappings (heuristic)
  const complementaryMap: Record<string, string[]> = {
    'footwear': ['clothing', 'fitness', 'accessories'],
    'electronics': ['accessories', 'home'],
    'fitness': ['footwear', 'clothing', 'nutrition'],
    'clothing': ['footwear', 'accessories'],
    'books': ['accessories', 'stationery'],
    'home': ['electronics', 'kitchen'],
    'kitchen': ['home', 'nutrition'],
    'accessories': ['electronics', 'clothing', 'footwear'],
  };

  for (const primaryCat of categories) {
    const complements = complementaryMap[primaryCat.toLowerCase()] ?? [];
    for (const compCat of complements) {
      // Find matching category in actual data (case-insensitive)
      const actualCompCat = categories.find(c => c.toLowerCase() === compCat);
      if (!actualCompCat || actualCompCat === primaryCat) continue;

      const primaryProducts = byCategory[primaryCat];
      const compProducts = byCategory[actualCompCat];
      if (!primaryProducts?.length || !compProducts?.length) continue;

      // Compute tag overlap
      const primaryTags = new Set(primaryProducts.flatMap(p => p.tags.map(t => t.toLowerCase())));
      const compTags = compProducts.flatMap(p => p.tags.map(t => t.toLowerCase()));
      const overlapCount = compTags.filter(t => primaryTags.has(t)).length;
      const overlapScore = Math.min(1, overlapCount / Math.max(primaryTags.size, 1));

      // Avoid duplicate pairs
      if (pairs.some(p => p.complementaryCategory === primaryCat && p.primaryCategory === actualCompCat)) continue;

      pairs.push({
        primaryCategory: primaryCat,
        complementaryCategory: actualCompCat,
        tagOverlapScore: Math.round(overlapScore * 100) / 100,
        examplePrimary: { id: primaryProducts[0].id, name: primaryProducts[0].name, price: primaryProducts[0].price },
        exampleComplement: { id: compProducts[0].id, name: compProducts[0].name, price: compProducts[0].price },
        suggestion: `Buyers of ${primaryCat} products frequently also purchase ${actualCompCat} items`,
      });
    }
  }

  return pairs
    .sort((a, b) => b.tagOverlapScore - a.tagOverlapScore)
    .slice(0, 8);
}

// ── Abandoned Cart Signals ────────────────────────────────────

/**
 * Returns transactions that are in a non-terminal state and older than 5 minutes.
 * These represent potential abandoned sessions. Purely synthetic/heuristic.
 */
export function getAbandonedCartSignals(db: SqlJsDatabase, merchantCatalogId?: string): AbandonedCartSignal[] {
  const terminalStates = ['COMPLETED', 'BLOCKED', 'CANCELLED', 'PAYMENT_FAILED', 'VERIFIED'];
  const placeholders = terminalStates.map(() => '?').join(', ');
  
  const whereClause = merchantCatalogId 
    ? `WHERE t.state NOT IN (${placeholders}) AND t.selected_product_name IS NOT NULL AND p.merchant_id = ?`
    : `WHERE t.state NOT IN (${placeholders}) AND t.selected_product_name IS NOT NULL`;
  const params = merchantCatalogId ? [...terminalStates, merchantCatalogId] : terminalStates;

  const joinClause = merchantCatalogId
    ? `JOIN products p ON t.selected_product_id = p.id`
    : `LEFT JOIN products p ON t.selected_product_id = p.id`;

  const stmt = db.prepare(`
    SELECT t.id, t.state, t.selected_product_name, t.selected_product_price, t.created_at
    FROM transactions t
    ${joinClause}
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT 10
  `);
  stmt.bind(params);

  const results: AbandonedCartSignal[] = [];
  const now = Date.now();

  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as TxnRow;
    const createdMs = new Date(row.created_at).getTime();
    const ageMinutes = Math.round((now - createdMs) / 60000);

    // Only surface sessions older than 5 minutes (likely abandoned)
    if (ageMinutes < 5) continue;

    const recoveryHints: Record<string, string> = {
      'APPROVAL_REQUIRED': 'Buyer is waiting for approval — send a reminder',
      'CART_READY': 'Cart was ready but checkout not started — consider a nudge',
      'POLICY_PENDING': 'Policy check stalled — review policy configuration',
      'PAYMENT_PENDING': 'Payment pending — may need payment recovery flow',
      'PAYMENT_UNKNOWN': 'Payment status unknown — trigger /api/payment/recover',
    };

    results.push({
      transactionId: row.id,
      productName: row.selected_product_name ?? 'Unknown',
      productPrice: row.selected_product_price ?? 0,
      state: row.state,
      ageMinutes,
      recoveryHint: recoveryHints[row.state] ?? `Stalled at ${row.state} — review manually`,
    });
  }
  stmt.free();

  return results;
}

// ── Campaign Suggestions ──────────────────────────────────────

/**
 * Generates campaign suggestions based on catalog characteristics.
 * No conversion or revenue data — purely structural signals.
 */
export function getCampaignSuggestions(db: SqlJsDatabase, merchantCatalogId?: string): CampaignSuggestion[] {
  const whereClause = merchantCatalogId ? `WHERE stock > 0 AND merchant_id = ?` : `WHERE stock > 0`;
  const params = merchantCatalogId ? [merchantCatalogId] : [];
  
  const stmt = db.prepare(`
    SELECT category,
           COUNT(*) as product_count,
           AVG(rating) as avg_rating,
           MIN(price) as min_price,
           MAX(price) as max_price,
           AVG(price) as avg_price
    FROM products
    ${whereClause}
    GROUP BY category
    ORDER BY avg_rating DESC
  `);
  stmt.bind(params);

  interface CatRow {
    category: string;
    product_count: number;
    avg_rating: number;
    min_price: number;
    max_price: number;
    avg_price: number;
  }

  const results: CampaignSuggestion[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as unknown as CatRow;
    const priceSpread = row.max_price / Math.max(row.min_price, 1);

    let action: CampaignSuggestion['suggestedAction'];
    let suggestion: string;

    if (row.avg_rating >= 4.5 && row.product_count >= 5) {
      action = 'HIGHLIGHT';
      suggestion = `Highlight "${row.category}" — high avg rating (${row.avg_rating.toFixed(1)}/5) with ${row.product_count} products`;
    } else if (priceSpread > 5 && row.product_count >= 4) {
      action = 'BUNDLE_OFFER';
      suggestion = `Bundle opportunity in "${row.category}" — wide price range (₹${Math.round(row.min_price)}–₹${Math.round(row.max_price)}) allows good/better/best bundles`;
    } else if (row.avg_rating < 4.0 && row.product_count >= 3) {
      action = 'PRICE_DROP';
      suggestion = `Consider price drop in "${row.category}" — avg rating ${row.avg_rating.toFixed(1)}/5 may indicate value concerns`;
    } else {
      action = 'CROSS_PROMOTE';
      suggestion = `Cross-promote "${row.category}" — ${row.product_count} products, potential synergy with adjacent categories`;
    }

    results.push({
      category: row.category,
      productCount: row.product_count,
      avgRating: Math.round(row.avg_rating * 10) / 10,
      priceRange: { min: Math.round(row.min_price), max: Math.round(row.max_price) },
      suggestion,
      suggestedAction: action,
    });
  }
  stmt.free();

  return results;
}

// ── Main Report ───────────────────────────────────────────────

/**
 * Generate the complete growth intelligence report.
 * All data is synthetic/heuristic — no real revenue claims.
 */
export function generateGrowthReport(db: SqlJsDatabase, merchantCatalogId?: string): GrowthIntelligenceReport {
  return {
    topRecommended: getTopRecommended(db, merchantCatalogId),
    upsellOpportunities: getUpsellOpportunities(db, merchantCatalogId),
    crossSellOpportunities: getCrossSellOpportunities(db, merchantCatalogId),
    abandonedCartSignals: getAbandonedCartSignals(db, merchantCatalogId),
    campaignSuggestions: getCampaignSuggestions(db, merchantCatalogId),
    generatedAt: new Date().toISOString(),
    dataNote: merchantCatalogId
      ? 'All signals are scoped to your specific merchant catalog.'
      : 'All signals are synthetic and derived from catalog heuristics. No actual conversion or revenue data is used.',
  };
}
