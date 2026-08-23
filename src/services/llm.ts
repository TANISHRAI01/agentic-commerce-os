// ============================================================
// LLM Service — Google Gemini abstraction with schema validation
// Structured output generation with retry logic
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z, type ZodSchema } from 'zod';

// ── Custom Error ─────────────────────────────────────────────

export class LLMValidationError extends Error {
  public readonly rawOutput: string;
  public readonly zodErrors: z.ZodError | null;

  constructor(message: string, rawOutput: string, zodErrors?: z.ZodError) {
    super(message);
    this.name = 'LLMValidationError';
    this.rawOutput = rawOutput;
    this.zodErrors = zodErrors ?? null;
  }
}

export class LLMConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMConnectionError';
  }
}

// ── Configuration ────────────────────────────────────────────

const MAX_RETRIES = 2;
const MODEL_NAME = 'gemini-3.5-flash';

// ── Singleton Client ─────────────────────────────────────────

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new LLMConnectionError(
      'GEMINI_API_KEY is not configured. Set it in your .env file.'
    );
  }

  client = new GoogleGenerativeAI(apiKey);
  return client;
}

// ── JSON Extraction ──────────────────────────────────────────

/**
 * Extract JSON from LLM output, stripping markdown code fences if present.
 */
export function extractJSON(raw: string): string {
  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  return raw.trim();
}

// ── Core Function ────────────────────────────────────────────

/**
 * Generate structured output from Gemini, validated against a Zod schema.
 * Retries up to MAX_RETRIES times on malformed output.
 *
 * @param systemPrompt - System instructions for the model
 * @param userPrompt - The user's input
 * @param schema - Zod schema to validate the output against
 * @returns Validated and typed output
 */
export async function generateStructuredOutput<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
): Promise<T> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.1, // Low temperature for deterministic structured output
      topP: 0.95,
      maxOutputTokens: 2048,
    },
  });

  let lastError: Error | null = null;
  let lastRawOutput = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const prompt = attempt === 0
        ? `${systemPrompt}\n\nUser request:\n${userPrompt}`
        : `${systemPrompt}\n\nIMPORTANT: Your previous response was not valid JSON. You MUST respond with ONLY a valid JSON object, no other text.\n\nUser request:\n${userPrompt}`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        lastError = new LLMValidationError(
          'LLM returned empty response',
          '',
        );
        continue;
      }

      lastRawOutput = text;

      // Extract and parse JSON
      const jsonStr = extractJSON(text);
      let parsed: unknown;

      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        lastError = new LLMValidationError(
          `Failed to parse LLM output as JSON (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
          text,
        );
        continue;
      }

      // Validate against schema
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        lastError = new LLMValidationError(
          `LLM output failed schema validation (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${validated.error.message}`,
          text,
          validated.error,
        );
        continue;
      }

      return validated.data;
    } catch (error) {
      if (error instanceof LLMValidationError) {
        lastError = error;
        continue;
      }

      // Network/API errors — don't retry
      throw new LLMConnectionError(
        `Gemini API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // All retries exhausted
  throw lastError ?? new LLMValidationError(
    'All LLM retries exhausted',
    lastRawOutput,
  );
}

/**
 * Reset the client (for testing purposes).
 */
export function resetClient(): void {
  client = null;
}
