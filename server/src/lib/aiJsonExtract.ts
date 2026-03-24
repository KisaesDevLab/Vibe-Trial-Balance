/**
 * Robust JSON extraction from AI responses.
 *
 * AI models frequently wrap JSON in markdown code fences (```json ... ```)
 * or add prose before/after. This utility strips fences first, then
 * extracts the outermost JSON object or array.
 */

/** Strip markdown code fences if present, then return cleaned text */
function stripFences(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : raw;
}

/** Extract and parse the first JSON object ({...}) from AI text */
export function extractJsonObject<T = unknown>(raw: string): T | null {
  try {
    const cleaned = stripFences(raw.trim());
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

/** Extract and parse the first JSON array ([...]) from AI text */
export function extractJsonArray<T = unknown>(raw: string): T[] | null {
  try {
    const cleaned = stripFences(raw.trim());
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return null;
    return parsed as T[];
  } catch {
    return null;
  }
}
