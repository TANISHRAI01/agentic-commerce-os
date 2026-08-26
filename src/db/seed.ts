// ============================================================
// Database Seed — Synthetic merchant catalog for demo
// 60 products across 6 merchants and 8 categories
// ============================================================

import type { Database as SqlJsDatabase } from 'sql.js';

interface SeedMerchant {
  id: string;
  name: string;
  trustTier: string;
  description: string;
  policies: string[];
  deliveryRegions: string[];
  paymentCapabilities: string[];
  businessRules: Record<string, unknown>;
}

interface SeedProduct {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  deliveryDays: number;
  attributes: Record<string, string>;
  tags: string[];
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'PREORDER';
  offerEligibility: string[];
}

// ── Merchants ────────────────────────────────────────────────

const MERCHANTS: SeedMerchant[] = [
  { id: 'merch-001', name: 'SoundWave Electronics', trustTier: 'PLATINUM', description: 'Premium audio and electronics retailer with 15+ years of excellence.', policies: ['30-day returns', '1-year warranty'], deliveryRegions: ['PAN_INDIA'], paymentCapabilities: ['RAZORPAY', 'UPI'], businessRules: { maxDiscount: 10 } },
  { id: 'merch-002', name: 'TechBazaar India', trustTier: 'GOLD', description: 'Trusted marketplace for tech gadgets and accessories.', policies: ['7-day replacement'], deliveryRegions: ['METROS_ONLY'], paymentCapabilities: ['RAZORPAY', 'COD'], businessRules: { maxDiscount: 15 } },
  { id: 'merch-003', name: 'GadgetZone', trustTier: 'SILVER', description: 'Affordable electronics and gadgets for everyday use.', policies: ['No returns'], deliveryRegions: ['PAN_INDIA'], paymentCapabilities: ['RAZORPAY'], businessRules: { maxDiscount: 20 } },
  { id: 'merch-004', name: 'HomeComfort Plus', trustTier: 'GOLD', description: 'Home appliances and comfort products specialist.', policies: ['15-day returns'], deliveryRegions: ['PAN_INDIA'], paymentCapabilities: ['RAZORPAY', 'EMI'], businessRules: { maxDiscount: 5 } },
  { id: 'merch-005', name: 'BookHaven', trustTier: 'PLATINUM', description: 'India\'s largest online bookstore with fast delivery.', policies: ['7-day returns'], deliveryRegions: ['PAN_INDIA'], paymentCapabilities: ['RAZORPAY', 'UPI', 'COD'], businessRules: { maxDiscount: 25 } },
  { id: 'merch-006', name: 'FitLife Store', trustTier: 'BRONZE', description: 'Fitness equipment and sports accessories.', policies: ['No returns on opened items'], deliveryRegions: ['SOUTH_INDIA_ONLY'], paymentCapabilities: ['RAZORPAY'], businessRules: { maxDiscount: 30 } },
];

// ── Products ─────────────────────────────────────────────────

const PRODUCTS: SeedProduct[] = [
  // ── Headphones (12 products) ──
  { id: 'prod-001', merchantId: 'merch-001', name: 'Sony WH-1000XM5', description: 'Industry-leading noise cancellation with 30-hour battery life. Premium over-ear wireless headphones with exceptional sound quality.', category: 'headphones', price: 24990, stock: 25, rating: 4.8, deliveryDays: 2, attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'Sony' }, tags: ['noise-cancelling', 'wireless', 'premium', 'bluetooth', 'over-ear'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-002', merchantId: 'merch-001', name: 'Sony WH-1000XM4', description: 'Previous gen flagship with excellent ANC. Comfortable fit for all-day wear with 30-hour battery.', category: 'headphones', price: 17990, stock: 18, rating: 4.7, deliveryDays: 2, attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'Sony' }, tags: ['noise-cancelling', 'wireless', 'bluetooth', 'over-ear'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-003', merchantId: 'merch-002', name: 'boAt Rockerz 550', description: 'Over-ear wireless headphones with 20-hour playback. Rich bass and comfortable padded earcups.', category: 'headphones', price: 1799, stock: 100, rating: 4.1, deliveryDays: 3, attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'false', brand: 'boAt' }, tags: ['wireless', 'bass', 'budget', 'bluetooth', 'over-ear'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-004', merchantId: 'merch-002', name: 'JBL Tune 760NC', description: 'Active noise cancelling wireless headphones with JBL Pure Bass Sound and 35-hour battery life.', category: 'headphones', price: 4499, stock: 45, rating: 4.3, deliveryDays: 3, attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'JBL' }, tags: ['noise-cancelling', 'wireless', 'bass', 'bluetooth', 'over-ear'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-005', merchantId: 'merch-001', name: 'Sennheiser HD 660S2', description: 'Open-back audiophile headphones with natural spatial sound. Reference-grade for music production.', category: 'headphones', price: 39990, stock: 8, rating: 4.9, deliveryDays: 4, attributes: { type: 'over-ear', connectivity: 'wired', anc: 'false', brand: 'Sennheiser' }, tags: ['audiophile', 'wired', 'open-back', 'premium', 'studio'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-006', merchantId: 'merch-003', name: 'Zebronics Thunder', description: 'Budget wireless headphones with Bluetooth 5.1 and 40mm drivers. Good sound at an affordable price.', category: 'headphones', price: 799, stock: 200, rating: 3.6, deliveryDays: 5, attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'false', brand: 'Zebronics' }, tags: ['budget', 'wireless', 'bluetooth', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-007', merchantId: 'merch-002', name: 'OnePlus Nord Buds 2r', description: 'In-ear TWS earbuds with 12.4mm titanium drivers and up to 38 hours total playback.', category: 'headphones', price: 2299, stock: 75, rating: 4.2, deliveryDays: 2, attributes: { type: 'in-ear', connectivity: 'bluetooth', anc: 'false', brand: 'OnePlus' }, tags: ['tws', 'earbuds', 'wireless', 'budget'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-008', merchantId: 'merch-001', name: 'Bose QuietComfort 45', description: 'Legendary Bose noise cancellation with high-fidelity audio. Comfortable enough for long flights.', category: 'headphones', price: 21990, stock: 12, rating: 4.7, deliveryDays: 3, attributes: { type: 'over-ear', connectivity: 'bluetooth', anc: 'true', brand: 'Bose' }, tags: ['noise-cancelling', 'wireless', 'premium', 'bluetooth', 'comfort'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-009', merchantId: 'merch-003', name: 'Realme Buds Wireless 3', description: 'Neckband earphones with 13.6mm bass driver and 40-hour playback. Active noise cancellation.', category: 'headphones', price: 1499, stock: 150, rating: 4.0, deliveryDays: 4, attributes: { type: 'neckband', connectivity: 'bluetooth', anc: 'true', brand: 'Realme' }, tags: ['neckband', 'wireless', 'anc', 'budget', 'bass'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-010', merchantId: 'merch-002', name: 'AKG K371', description: 'Closed-back studio headphones with reference tuning. Foldable design for portability.', category: 'headphones', price: 7499, stock: 20, rating: 4.5, deliveryDays: 3, attributes: { type: 'over-ear', connectivity: 'wired', anc: 'false', brand: 'AKG' }, tags: ['studio', 'wired', 'reference', 'foldable', 'professional'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-011', merchantId: 'merch-001', name: 'Apple AirPods Pro 2', description: 'Active noise cancellation with Adaptive Transparency. Personalized Spatial Audio with dynamic head tracking.', category: 'headphones', price: 24900, stock: 30, rating: 4.8, deliveryDays: 1, attributes: { type: 'in-ear', connectivity: 'bluetooth', anc: 'true', brand: 'Apple' }, tags: ['tws', 'noise-cancelling', 'premium', 'spatial-audio', 'apple'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-012', merchantId: 'merch-003', name: 'boAt Airdopes 141', description: 'TWS earbuds with 42-hour total playback and 8mm drivers. ENx noise cancelling for calls.', category: 'headphones', price: 1099, stock: 300, rating: 3.9, deliveryDays: 3, attributes: { type: 'in-ear', connectivity: 'bluetooth', anc: 'false', brand: 'boAt' }, tags: ['tws', 'budget', 'earbuds', 'wireless', 'long-battery'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },

  // ── Laptops (8 products) ──
  { id: 'prod-013', merchantId: 'merch-002', name: 'ASUS VivoBook 15', description: '15.6" FHD laptop with Intel Core i5, 8GB RAM, 512GB SSD. Perfect for students and professionals.', category: 'laptops', price: 42990, stock: 15, rating: 4.3, deliveryDays: 3, attributes: { brand: 'ASUS', processor: 'Intel i5', ram: '8GB', storage: '512GB SSD', screen: '15.6"' }, tags: ['laptop', 'student', 'lightweight', 'ssd', 'intel'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-014', merchantId: 'merch-001', name: 'MacBook Air M2', description: 'Apple M2 chip with 8-core GPU. 13.6" Liquid Retina display. All-day battery life up to 18 hours.', category: 'laptops', price: 99900, stock: 10, rating: 4.9, deliveryDays: 2, attributes: { brand: 'Apple', processor: 'M2', ram: '8GB', storage: '256GB SSD', screen: '13.6"' }, tags: ['premium', 'macbook', 'apple', 'ultralight', 'creative'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-015', merchantId: 'merch-002', name: 'Lenovo IdeaPad Slim 3', description: '14" FHD laptop with AMD Ryzen 5, 8GB RAM, 512GB SSD. Thin, light, and affordable.', category: 'laptops', price: 36990, stock: 22, rating: 4.1, deliveryDays: 4, attributes: { brand: 'Lenovo', processor: 'AMD Ryzen 5', ram: '8GB', storage: '512GB SSD', screen: '14"' }, tags: ['laptop', 'amd', 'thin', 'affordable', 'office'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-016', merchantId: 'merch-001', name: 'HP Pavilion Gaming 15', description: '15.6" FHD 144Hz gaming laptop with Intel i5, GTX 1650, 8GB RAM. Entry-level gaming performance.', category: 'laptops', price: 54990, stock: 8, rating: 4.2, deliveryDays: 3, attributes: { brand: 'HP', processor: 'Intel i5', ram: '8GB', storage: '512GB SSD', gpu: 'GTX 1650', screen: '15.6"' }, tags: ['gaming', 'nvidia', '144hz', 'entry-gaming'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-017', merchantId: 'merch-003', name: 'Acer Aspire Lite', description: '15.6" laptop with Intel i3, 8GB RAM, 256GB SSD. Basic computing for everyday tasks.', category: 'laptops', price: 24990, stock: 35, rating: 3.8, deliveryDays: 5, attributes: { brand: 'Acer', processor: 'Intel i3', ram: '8GB', storage: '256GB SSD', screen: '15.6"' }, tags: ['budget', 'basic', 'office', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-018', merchantId: 'merch-002', name: 'Dell Inspiron 14', description: '14" FHD laptop with Intel i5, 16GB RAM, 512GB SSD. Built for productivity.', category: 'laptops', price: 52990, stock: 12, rating: 4.4, deliveryDays: 3, attributes: { brand: 'Dell', processor: 'Intel i5', ram: '16GB', storage: '512GB SSD', screen: '14"' }, tags: ['productivity', 'business', '16gb', 'reliable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-019', merchantId: 'merch-001', name: 'ASUS ROG Strix G16', description: '16" QHD 165Hz gaming laptop with Intel i7, RTX 4060, 16GB RAM. Serious gaming performance.', category: 'laptops', price: 109990, stock: 5, rating: 4.7, deliveryDays: 4, attributes: { brand: 'ASUS', processor: 'Intel i7', ram: '16GB', storage: '1TB SSD', gpu: 'RTX 4060', screen: '16"' }, tags: ['gaming', 'premium', 'rtx', 'high-performance', 'qhd'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-020', merchantId: 'merch-003', name: 'HP 15s', description: '15.6" laptop with AMD Ryzen 3, 8GB RAM, 256GB SSD. Reliable everyday computing.', category: 'laptops', price: 28990, stock: 40, rating: 3.9, deliveryDays: 4, attributes: { brand: 'HP', processor: 'AMD Ryzen 3', ram: '8GB', storage: '256GB SSD', screen: '15.6"' }, tags: ['budget', 'everyday', 'amd', 'reliable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },

  // ── Smartphones (8 products) ──
  { id: 'prod-021', merchantId: 'merch-002', name: 'Samsung Galaxy S24', description: 'Galaxy AI powered smartphone with 6.2" Dynamic AMOLED, Snapdragon 8 Gen 3, 50MP camera.', category: 'smartphones', price: 69999, stock: 20, rating: 4.6, deliveryDays: 2, attributes: { brand: 'Samsung', processor: 'Snapdragon 8 Gen 3', ram: '8GB', storage: '128GB', screen: '6.2"' }, tags: ['flagship', 'ai', 'samsung', 'camera', '5g'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-022', merchantId: 'merch-001', name: 'iPhone 15', description: 'A16 Bionic chip with 48MP camera system. Dynamic Island and USB-C connectivity.', category: 'smartphones', price: 69900, stock: 15, rating: 4.7, deliveryDays: 1, attributes: { brand: 'Apple', processor: 'A16 Bionic', ram: '6GB', storage: '128GB', screen: '6.1"' }, tags: ['flagship', 'apple', 'iphone', 'camera', '5g'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-023', merchantId: 'merch-003', name: 'Redmi Note 13 Pro', description: '6.67" AMOLED display with 200MP camera. MediaTek Dimensity 7200 for smooth performance.', category: 'smartphones', price: 22999, stock: 60, rating: 4.2, deliveryDays: 3, attributes: { brand: 'Xiaomi', processor: 'Dimensity 7200', ram: '8GB', storage: '128GB', screen: '6.67"' }, tags: ['mid-range', 'camera', 'amoled', '5g', 'value'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-024', merchantId: 'merch-002', name: 'OnePlus 12R', description: '6.78" ProXDR display with Snapdragon 8 Gen 2. 100W SUPERVOOC charging and 5500mAh battery.', category: 'smartphones', price: 39999, stock: 30, rating: 4.5, deliveryDays: 2, attributes: { brand: 'OnePlus', processor: 'Snapdragon 8 Gen 2', ram: '8GB', storage: '128GB', screen: '6.78"' }, tags: ['performance', 'fast-charging', 'flagship-killer', '5g'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-025', merchantId: 'merch-003', name: 'Realme Narzo 70x', description: '6.72" display with Dimensity 6100+ and 50MP camera. 5000mAh battery with 45W charging.', category: 'smartphones', price: 11999, stock: 80, rating: 3.9, deliveryDays: 4, attributes: { brand: 'Realme', processor: 'Dimensity 6100+', ram: '4GB', storage: '64GB', screen: '6.72"' }, tags: ['budget', '5g', 'battery', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-026', merchantId: 'merch-001', name: 'Google Pixel 8a', description: 'Google Tensor G3 with 7 years of updates. 64MP camera with Magic Eraser and Photo Unblur.', category: 'smartphones', price: 52999, stock: 12, rating: 4.5, deliveryDays: 2, attributes: { brand: 'Google', processor: 'Tensor G3', ram: '8GB', storage: '128GB', screen: '6.1"' }, tags: ['google', 'ai', 'camera', 'clean-android', 'updates'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-027', merchantId: 'merch-002', name: 'Nothing Phone (2)', description: '6.7" OLED with Glyph Interface. Snapdragon 8+ Gen 1 with unique transparent design.', category: 'smartphones', price: 37999, stock: 18, rating: 4.3, deliveryDays: 3, attributes: { brand: 'Nothing', processor: 'Snapdragon 8+ Gen 1', ram: '8GB', storage: '128GB', screen: '6.7"' }, tags: ['design', 'unique', 'oled', 'transparent'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-028', merchantId: 'merch-003', name: 'Samsung Galaxy A15', description: '6.5" Super AMOLED with 50MP triple camera. Affordable Samsung with One UI experience.', category: 'smartphones', price: 13999, stock: 90, rating: 4.0, deliveryDays: 3, attributes: { brand: 'Samsung', processor: 'Helio G99', ram: '4GB', storage: '128GB', screen: '6.5"' }, tags: ['budget', 'samsung', 'amoled', 'camera'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },

  // ── Books (8 products) ──
  { id: 'prod-029', merchantId: 'merch-005', name: 'Atomic Habits by James Clear', description: 'An easy and proven way to build good habits and break bad ones. #1 NYT bestseller.', category: 'books', price: 350, stock: 500, rating: 4.8, deliveryDays: 1, attributes: { author: 'James Clear', genre: 'self-help', format: 'paperback', pages: '320' }, tags: ['self-help', 'habits', 'bestseller', 'productivity'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-030', merchantId: 'merch-005', name: 'The Psychology of Money', description: 'Timeless lessons on wealth, greed, and happiness by Morgan Housel.', category: 'books', price: 299, stock: 400, rating: 4.7, deliveryDays: 1, attributes: { author: 'Morgan Housel', genre: 'finance', format: 'paperback', pages: '256' }, tags: ['finance', 'money', 'investing', 'bestseller'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-031', merchantId: 'merch-005', name: 'Deep Work by Cal Newport', description: 'Rules for focused success in a distracted world. Essential reading for knowledge workers.', category: 'books', price: 399, stock: 200, rating: 4.6, deliveryDays: 1, attributes: { author: 'Cal Newport', genre: 'productivity', format: 'paperback', pages: '304' }, tags: ['productivity', 'focus', 'work', 'career'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-032', merchantId: 'merch-005', name: 'Sapiens by Yuval Noah Harari', description: 'A brief history of humankind. Explores how Homo sapiens came to dominate the world.', category: 'books', price: 449, stock: 300, rating: 4.7, deliveryDays: 2, attributes: { author: 'Yuval Noah Harari', genre: 'history', format: 'paperback', pages: '464' }, tags: ['history', 'science', 'bestseller', 'non-fiction'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-033', merchantId: 'merch-005', name: 'The Alchemist by Paulo Coelho', description: 'A magical fable about following your dreams. One of the most translated books in history.', category: 'books', price: 199, stock: 600, rating: 4.5, deliveryDays: 1, attributes: { author: 'Paulo Coelho', genre: 'fiction', format: 'paperback', pages: '208' }, tags: ['fiction', 'classic', 'inspirational', 'adventure'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-034', merchantId: 'merch-005', name: 'Clean Code by Robert C. Martin', description: 'A handbook of agile software craftsmanship. Essential for every developer.', category: 'books', price: 2499, stock: 50, rating: 4.6, deliveryDays: 2, attributes: { author: 'Robert C. Martin', genre: 'programming', format: 'paperback', pages: '464' }, tags: ['programming', 'software', 'engineering', 'technical'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-035', merchantId: 'merch-005', name: 'Ikigai by Héctor García', description: 'The Japanese secret to a long and happy life. Discover your purpose.', category: 'books', price: 250, stock: 350, rating: 4.4, deliveryDays: 1, attributes: { author: 'Héctor García', genre: 'self-help', format: 'paperback', pages: '208' }, tags: ['self-help', 'japanese', 'purpose', 'happiness'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-036', merchantId: 'merch-005', name: 'Zero to One by Peter Thiel', description: 'Notes on startups, or how to build the future. Contrarian thinking for entrepreneurs.', category: 'books', price: 350, stock: 180, rating: 4.5, deliveryDays: 2, attributes: { author: 'Peter Thiel', genre: 'business', format: 'paperback', pages: '224' }, tags: ['startup', 'business', 'entrepreneurship', 'innovation'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },

  // ── Fitness (8 products) ──
  { id: 'prod-037', merchantId: 'merch-006', name: 'Boldfit Resistance Bands Set', description: '5 resistance bands with different tension levels. Perfect for home workouts and physical therapy.', category: 'fitness', price: 499, stock: 200, rating: 4.2, deliveryDays: 3, attributes: { type: 'resistance-bands', count: '5', material: 'latex' }, tags: ['workout', 'home-gym', 'bands', 'stretching', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-038', merchantId: 'merch-006', name: 'JEETA Yoga Mat (6mm)', description: 'Anti-skid yoga mat with carrying strap. High-density foam for comfort and support.', category: 'fitness', price: 599, stock: 150, rating: 4.1, deliveryDays: 4, attributes: { type: 'yoga-mat', thickness: '6mm', material: 'NBR foam' }, tags: ['yoga', 'mat', 'exercise', 'home-workout'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-039', merchantId: 'merch-006', name: 'Lifelong Adjustable Dumbbells 10kg', description: 'Adjustable dumbbell set with rubber-coated plates. Space-saving design for home gym.', category: 'fitness', price: 1499, stock: 60, rating: 4.0, deliveryDays: 5, attributes: { type: 'dumbbells', weight: '10kg', material: 'rubber-coated steel' }, tags: ['strength', 'dumbbells', 'home-gym', 'adjustable', 'weights'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-040', merchantId: 'merch-006', name: 'Fitbit Charge 6', description: 'Advanced fitness tracker with GPS, heart rate monitoring, sleep tracking, and stress management.', category: 'fitness', price: 14999, stock: 25, rating: 4.4, deliveryDays: 2, attributes: { type: 'fitness-tracker', brand: 'Fitbit', features: 'GPS,HR,Sleep' }, tags: ['tracker', 'smartwatch', 'heart-rate', 'gps', 'health'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-041', merchantId: 'merch-006', name: 'Protoner 20kg Home Gym Set', description: 'Complete home gym set with 20kg PVC weights, 3-in-1 bench, and barbell/dumbbell rods.', category: 'fitness', price: 2499, stock: 30, rating: 3.8, deliveryDays: 6, attributes: { type: 'home-gym-set', weight: '20kg', includes: 'bench,rods,plates' }, tags: ['home-gym', 'weights', 'complete-set', 'bench'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-042', merchantId: 'merch-002', name: 'Noise ColorFit Pro 5', description: 'Smart fitness watch with AMOLED display, SpO2, heart rate, and 150+ watch faces.', category: 'fitness', price: 3499, stock: 40, rating: 4.1, deliveryDays: 2, attributes: { type: 'smartwatch', brand: 'Noise', display: 'AMOLED' }, tags: ['smartwatch', 'fitness', 'amoled', 'spo2', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-043', merchantId: 'merch-006', name: 'Boldfit Protein Shaker 700ml', description: 'Leak-proof protein shaker with mixing ball. BPA-free and dishwasher safe.', category: 'fitness', price: 299, stock: 300, rating: 4.3, deliveryDays: 3, attributes: { type: 'shaker', capacity: '700ml', material: 'BPA-free plastic' }, tags: ['protein', 'shaker', 'gym-accessories', 'bottle'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-044', merchantId: 'merch-006', name: 'Strauss Skipping Rope', description: 'Adjustable skipping rope with foam grip handles. Great for cardio and HIIT workouts.', category: 'fitness', price: 199, stock: 250, rating: 4.0, deliveryDays: 3, attributes: { type: 'skipping-rope', material: 'PVC with foam grips' }, tags: ['cardio', 'skipping', 'hiit', 'affordable', 'portable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },

  // ── Home & Kitchen (8 products) ──
  { id: 'prod-045', merchantId: 'merch-004', name: 'Philips Air Fryer HD9200', description: '4.1L air fryer with Rapid Air technology. Fry, bake, grill, and roast with up to 90% less fat.', category: 'home-kitchen', price: 6495, stock: 20, rating: 4.4, deliveryDays: 3, attributes: { brand: 'Philips', capacity: '4.1L', type: 'air-fryer', power: '1400W' }, tags: ['air-fryer', 'healthy-cooking', 'kitchen', 'philips'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-046', merchantId: 'merch-004', name: 'InstantPot Duo 7-in-1', description: '6L multi-use pressure cooker, slow cooker, rice cooker, steamer, sauté pan, and warmer.', category: 'home-kitchen', price: 8999, stock: 15, rating: 4.6, deliveryDays: 4, attributes: { brand: 'Instant Pot', capacity: '6L', type: 'pressure-cooker', functions: '7' }, tags: ['instant-pot', 'multi-cooker', 'kitchen', 'pressure-cooker'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-047', merchantId: 'merch-004', name: 'Prestige Iris 750W Mixer Grinder', description: '750W mixer grinder with 3 stainless steel jars. Super-silent motor technology.', category: 'home-kitchen', price: 3499, stock: 40, rating: 4.2, deliveryDays: 3, attributes: { brand: 'Prestige', power: '750W', type: 'mixer-grinder', jars: '3' }, tags: ['mixer', 'grinder', 'kitchen', 'prestige'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-048', merchantId: 'merch-004', name: 'Dyson V12 Detect Slim', description: 'Cordless vacuum cleaner with laser dust detection. 60 minutes of fade-free power.', category: 'home-kitchen', price: 49900, stock: 6, rating: 4.8, deliveryDays: 3, attributes: { brand: 'Dyson', type: 'vacuum', power: 'cordless', runtime: '60min' }, tags: ['vacuum', 'cordless', 'premium', 'dyson', 'cleaning'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-049', merchantId: 'merch-003', name: 'Milton Thermosteel Flask 1L', description: '1L stainless steel vacuum insulated flask. Keeps hot for 24 hours, cold for 24 hours.', category: 'home-kitchen', price: 799, stock: 100, rating: 4.3, deliveryDays: 3, attributes: { brand: 'Milton', capacity: '1L', type: 'flask', material: 'stainless steel' }, tags: ['flask', 'thermos', 'hot-cold', 'steel'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-050', merchantId: 'merch-004', name: 'Borosil 6.5L OTG', description: '6.5L oven toaster grill with 1000W power. Perfect for baking, toasting, and grilling.', category: 'home-kitchen', price: 2999, stock: 25, rating: 4.0, deliveryDays: 4, attributes: { brand: 'Borosil', capacity: '6.5L', type: 'otg', power: '1000W' }, tags: ['oven', 'baking', 'grilling', 'kitchen'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-051', merchantId: 'merch-004', name: 'Havells Instanio 3L Water Heater', description: '3L instant water heater with heavy-duty glass-coated tank. 4 safety protection systems.', category: 'home-kitchen', price: 4999, stock: 18, rating: 4.1, deliveryDays: 5, attributes: { brand: 'Havells', capacity: '3L', type: 'water-heater', power: '3000W' }, tags: ['water-heater', 'geyser', 'winter', 'bathroom'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-052', merchantId: 'merch-003', name: 'Pigeon Handy Chopper', description: 'Manual food chopper with 3 blades. Chop vegetables, fruits, nuts in seconds.', category: 'home-kitchen', price: 249, stock: 400, rating: 4.1, deliveryDays: 3, attributes: { brand: 'Pigeon', type: 'chopper', blades: '3', manual: 'true' }, tags: ['chopper', 'kitchen', 'manual', 'affordable', 'vegetables'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },

  // ── Accessories (8 products) ──
  { id: 'prod-053', merchantId: 'merch-002', name: 'Samsung T7 1TB Portable SSD', description: '1TB portable SSD with USB 3.2. Transfer speeds up to 1050 MB/s. Compact and durable.', category: 'accessories', price: 7999, stock: 25, rating: 4.6, deliveryDays: 2, attributes: { brand: 'Samsung', type: 'portable-ssd', capacity: '1TB', speed: '1050 MB/s' }, tags: ['storage', 'ssd', 'portable', 'fast', 'samsung'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-054', merchantId: 'merch-002', name: 'Anker PowerCore 20000mAh', description: '20000mAh power bank with dual USB ports and 18W fast charging. Enough for 4+ phone charges.', category: 'accessories', price: 2499, stock: 50, rating: 4.5, deliveryDays: 2, attributes: { brand: 'Anker', type: 'power-bank', capacity: '20000mAh', ports: '2' }, tags: ['power-bank', 'charging', 'portable', 'fast-charge'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-055', merchantId: 'merch-003', name: 'Amazon Basics Laptop Bag 15.6"', description: 'Slim, compact laptop bag with padded interior and multiple compartments.', category: 'accessories', price: 699, stock: 150, rating: 4.0, deliveryDays: 3, attributes: { brand: 'Amazon Basics', type: 'laptop-bag', size: '15.6"' }, tags: ['bag', 'laptop', 'travel', 'office', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-056', merchantId: 'merch-001', name: 'Logitech MX Master 3S', description: 'Advanced wireless mouse with 8K DPI sensor. Quiet clicks and MagSpeed scroll wheel.', category: 'accessories', price: 8495, stock: 15, rating: 4.8, deliveryDays: 2, attributes: { brand: 'Logitech', type: 'mouse', connectivity: 'bluetooth', dpi: '8000' }, tags: ['mouse', 'wireless', 'premium', 'ergonomic', 'productivity'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-057', merchantId: 'merch-002', name: 'Ambrane 65W GaN Charger', description: '65W GaN charger with USB-C PD and USB-A ports. Compact and travel-friendly.', category: 'accessories', price: 1799, stock: 70, rating: 4.3, deliveryDays: 2, attributes: { brand: 'Ambrane', type: 'charger', power: '65W', technology: 'GaN' }, tags: ['charger', 'fast-charge', 'usb-c', 'gan', 'compact'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-058', merchantId: 'merch-003', name: 'Croma USB-C Hub 7-in-1', description: '7-in-1 USB-C hub with HDMI, USB 3.0, SD card reader, and PD charging passthrough.', category: 'accessories', price: 1999, stock: 45, rating: 4.1, deliveryDays: 3, attributes: { brand: 'Croma', type: 'usb-hub', ports: '7', features: 'HDMI,USB3,SD' }, tags: ['hub', 'usb-c', 'dock', 'hdmi', 'adapter'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-059', merchantId: 'merch-001', name: 'Keychron K2 V2 Mechanical Keyboard', description: '75% wireless mechanical keyboard with Gateron switches. Bluetooth + USB-C. RGB backlight.', category: 'accessories', price: 6999, stock: 10, rating: 4.6, deliveryDays: 4, attributes: { brand: 'Keychron', type: 'keyboard', layout: '75%', switches: 'Gateron', connectivity: 'bluetooth' }, tags: ['keyboard', 'mechanical', 'wireless', 'rgb', 'premium'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
  { id: 'prod-060', merchantId: 'merch-002', name: 'boAt Watch Xtend Plus', description: '1.78" AMOLED smartwatch with Bluetooth calling, SpO2, and 100+ sports modes.', category: 'accessories', price: 2499, stock: 55, rating: 4.0, deliveryDays: 2, attributes: { brand: 'boAt', type: 'smartwatch', display: '1.78" AMOLED' }, tags: ['smartwatch', 'calling', 'amoled', 'sports', 'affordable'], availability: 'IN_STOCK', offerEligibility: ['FESTIVE10'] },
];

/**
 * Seed the database with merchants and products.
 * Clears existing data first to ensure clean state.
 */
export function seedDatabase(db: SqlJsDatabase): { merchants: number; products: number } {
  // Clear existing data
  db.run('DELETE FROM audit_events');
  db.run('DELETE FROM transactions');
  db.run('DELETE FROM products');
  db.run('DELETE FROM merchants');
  db.run('DELETE FROM metrics');

  // Insert merchants
  for (const m of MERCHANTS) {
    db.run(
      `INSERT INTO merchants (id, name, trust_tier, description, policies, delivery_regions, payment_capabilities, business_rules) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.name, m.trustTier, m.description, JSON.stringify(m.policies), JSON.stringify(m.deliveryRegions), JSON.stringify(m.paymentCapabilities), JSON.stringify(m.businessRules)],
    );
  }

  // Insert products
  for (const p of PRODUCTS) {
    const merchant = MERCHANTS.find(m => m.id === p.merchantId);
    db.run(
      `INSERT INTO products (id, merchant_id, name, description, category, price, currency, stock, rating, delivery_days, merchant_trust_tier, attributes, tags, availability, offer_eligibility)
       VALUES (?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id, p.merchantId, p.name, p.description, p.category, p.price,
        p.stock, p.rating, p.deliveryDays,
        merchant?.trustTier || 'UNRATED',
        JSON.stringify(p.attributes),
        JSON.stringify(p.tags),
        p.availability,
        JSON.stringify(p.offerEligibility),
      ],
    );
  }

  return { merchants: MERCHANTS.length, products: PRODUCTS.length };
}

/** Exported for testing */
export { MERCHANTS, PRODUCTS };
