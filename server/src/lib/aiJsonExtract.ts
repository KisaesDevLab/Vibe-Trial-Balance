// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Robust JSON extraction from AI responses.
 *
 * AI models frequently wrap JSON in markdown code fences (```json ... ```)
 * or add prose before/after. This utility strips fences first, then
 * extracts the outermost JSON object or array.
 */

/** Strip markdown code fences if present, then return cleaned text */
function stripFences(raw: string): string {
  const fenceMatch = raw.match(/(?:```|~~~)(?:json)?\s*\n?([\s\S]*?)(?:```|~~~)/);
  return fenceMatch ? fenceMatch[1].trim() : raw;
}

/**
 * Walk the string and return the span of the first balanced pair of the given
 * open/close brackets. Handles nested braces and JSON strings (which can
 * themselves contain braces / escaped quotes). Returns null if no balanced
 * pair is found. Used instead of a greedy regex, which would grab from the
 * first `{` all the way to the LAST `}` in the text — swallowing any prose
 * between two JSON blobs and failing to parse.
 */
function findBalanced(s: string, open: string, close: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0 && start >= 0) {
        return s.slice(start, i + 1);
      }
    }
  }
  return null;
}

/** Extract and parse the first JSON object ({...}) from AI text */
export function extractJsonObject<T = unknown>(raw: string): T | null {
  try {
    const cleaned = stripFences(raw.trim());
    const balanced = findBalanced(cleaned, '{', '}');
    if (!balanced) return null;
    return JSON.parse(balanced) as T;
  } catch {
    return null;
  }
}

/** Extract and parse the first JSON array ([...]) from AI text */
export function extractJsonArray<T = unknown>(raw: string): T[] | null {
  try {
    const cleaned = stripFences(raw.trim());
    const balanced = findBalanced(cleaned, '[', ']');
    if (!balanced) return null;
    const parsed = JSON.parse(balanced);
    if (!Array.isArray(parsed)) return null;
    return parsed as T[];
  } catch {
    return null;
  }
}
