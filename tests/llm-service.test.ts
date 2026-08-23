// ============================================================
// LLM Service Tests — Schema validation, JSON extraction, retry
// Uses mocked LLM responses (no API key required)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractJSON } from '@/services/llm';

// ── extractJSON Tests ────────────────────────────────────────

describe('extractJSON', () => {
  it('should extract JSON from plain JSON string', () => {
    const raw = '{"category": "headphones", "maximumPrice": 8000}';
    const result = extractJSON(raw);
    expect(JSON.parse(result)).toEqual({ category: 'headphones', maximumPrice: 8000 });
  });

  it('should extract JSON from markdown code fence', () => {
    const raw = '```json\n{"category": "laptops", "maximumPrice": 40000}\n```';
    const result = extractJSON(raw);
    expect(JSON.parse(result)).toEqual({ category: 'laptops', maximumPrice: 40000 });
  });

  it('should extract JSON from plain code fence without language tag', () => {
    const raw = '```\n{"category": "books"}\n```';
    const result = extractJSON(raw);
    expect(JSON.parse(result)).toEqual({ category: 'books' });
  });

  it('should extract JSON embedded in text', () => {
    const raw = 'Here is the result:\n{"category": "fitness", "maximumPrice": 5000}\n\nHope this helps!';
    const result = extractJSON(raw);
    expect(JSON.parse(result)).toEqual({ category: 'fitness', maximumPrice: 5000 });
  });

  it('should handle nested JSON objects', () => {
    const raw = '{"category": "headphones", "requiredAttributes": ["noise-cancelling", "wireless"]}';
    const result = extractJSON(raw);
    const parsed = JSON.parse(result);
    expect(parsed.requiredAttributes).toEqual(['noise-cancelling', 'wireless']);
  });

  it('should return raw string when no JSON found', () => {
    const raw = 'This is not JSON at all';
    const result = extractJSON(raw);
    expect(result).toBe('This is not JSON at all');
  });

  it('should handle multiline JSON inside code fences', () => {
    const raw = '```json\n{\n  "category": "smartphones",\n  "maximumPrice": 30000,\n  "requiredAttributes": ["5g"]\n}\n```';
    const result = extractJSON(raw);
    const parsed = JSON.parse(result);
    expect(parsed.category).toBe('smartphones');
    expect(parsed.maximumPrice).toBe(30000);
  });
});
