/**
 * Evaluates a simple arithmetic expression entered in an amount field.
 * e.g. "94+4" → "98", "1000*0.05" → "50", "500-100/2" → "450"
 *
 * Returns the original string unchanged if:
 *  - there are no operators (plain number like "1234.56")
 *  - the expression contains unsafe characters
 *  - evaluation fails
 */
export function evalAmountExpr(raw: string): string {
  // Strip currency symbols, commas, and spaces for parsing
  const s = raw.trim().replace(/[$,\s]/g, '');
  if (!s) return raw;

  // Check whether there's actually an operator to evaluate.
  // Skip a leading +/- sign (negative amounts like "-85.00") when looking.
  const body = s.replace(/^[+\-]/, '');
  if (!/[+\-*/]/.test(body)) return raw;

  // Safety gate: only digits, decimal point, operators, and parentheses allowed
  if (!/^[0-9+\-*/.()]+$/.test(s)) return raw;

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${s})`)() as unknown;
    if (typeof result !== 'number' || !isFinite(result)) return raw;
    const rounded = Math.round(result * 100) / 100;
    return String(rounded);
  } catch {
    return raw;
  }
}

/**
 * Evaluates an expression (if any) then formats the result to exactly 2 decimal
 * places. Use this on blur so "85" → "85.00", "94+4" → "98.00", "-1000" → "-1000.00".
 * Returns the original string unchanged if it is empty or cannot be parsed.
 */
export function evalAndFormatAmount(raw: string): string {
  if (!raw.trim()) return raw;
  const evaled = evalAmountExpr(raw);
  // Strip currency symbols / commas / spaces before parsing
  const n = parseFloat(evaled.replace(/[$,\s]/g, ''));
  if (isNaN(n)) return evaled;
  return n.toFixed(2);
}
