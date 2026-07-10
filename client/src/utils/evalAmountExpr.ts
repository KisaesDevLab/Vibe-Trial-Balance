// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Evaluates a simple arithmetic expression entered in an amount field.
 * e.g. "94+4" → "98", "1000*0.05" → "50", "500-100/2" → "450"
 *
 * Uses a safe recursive-descent parser — no eval() or new Function().
 *
 * Returns the original string unchanged if:
 *  - there are no operators (plain number like "1234.56")
 *  - the expression contains unsafe characters
 *  - evaluation fails
 */

// ── Safe arithmetic parser (no eval/Function) ──────────────────────────────

type Parser = { pos: number; expr: string };

function peek(p: Parser): string {
  return p.expr[p.pos] ?? '';
}

function consume(p: Parser): string {
  return p.expr[p.pos++] ?? '';
}

function skipSpaces(p: Parser): void {
  while (p.pos < p.expr.length && p.expr[p.pos] === ' ') p.pos++;
}

function parseNumber(p: Parser): number {
  skipSpaces(p);
  let numStr = '';
  // Handle unary minus/plus
  if (peek(p) === '-' || peek(p) === '+') {
    numStr += consume(p);
  }
  while (p.pos < p.expr.length && (/[0-9.]/).test(peek(p))) {
    numStr += consume(p);
  }
  const val = parseFloat(numStr);
  if (isNaN(val)) throw new Error('Expected number');
  return val;
}

function parseFactor(p: Parser): number {
  skipSpaces(p);
  if (peek(p) === '(') {
    consume(p); // skip '('
    const val = parseAddSub(p);
    skipSpaces(p);
    if (peek(p) !== ')') throw new Error('Expected )');
    consume(p); // skip ')'
    return val;
  }
  return parseNumber(p);
}

function parseMulDiv(p: Parser): number {
  let left = parseFactor(p);
  skipSpaces(p);
  while (peek(p) === '*' || peek(p) === '/') {
    const op = consume(p);
    const right = parseFactor(p);
    left = op === '*' ? left * right : left / right;
    skipSpaces(p);
  }
  return left;
}

function parseAddSub(p: Parser): number {
  let left = parseMulDiv(p);
  skipSpaces(p);
  while (peek(p) === '+' || peek(p) === '-') {
    const op = consume(p);
    const right = parseMulDiv(p);
    left = op === '+' ? left + right : left - right;
    skipSpaces(p);
  }
  return left;
}

function safeEval(expr: string): number {
  const p: Parser = { pos: 0, expr };
  const result = parseAddSub(p);
  skipSpaces(p);
  if (p.pos !== p.expr.length) throw new Error('Unexpected character');
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function evalAmountExpr(raw: string): string {
  // Strip currency symbols, commas, and spaces for parsing
  let s = raw.trim().replace(/[$,\s]/g, '');
  if (!s) return raw;

  // Accounting convention: "(1,234.56)" means negative $1,234.56. Detect
  // pure-magnitude parens and convert to a leading minus BEFORE the math
  // parser treats `(...)` as grouping. Without this, users entering credits
  // as `(250.00)` in the debit column had the sign silently dropped. Also
  // handles a leading sign outside the parens (e.g. "-(100)" → "-(-100)" is
  // just "100", "+(100)" → "-100").
  const parenMatch = /^([+\-]?)\(([0-9]+(?:\.[0-9]+)?)\)$/.exec(s);
  if (parenMatch) {
    const outerSign = parenMatch[1];
    // Inside-parens magnitude is always negated per accounting convention.
    // An outer '-' negates again (double negative → positive); outer '+' or
    // no sign leaves it negative.
    const sign = outerSign === '-' ? '' : '-';
    s = sign + parenMatch[2];
  }

  // Check whether there's actually an operator to evaluate.
  // Skip a leading +/- sign (negative amounts like "-85.00") when looking.
  const body = s.replace(/^[+\-]/, '');
  if (!/[+\-*/]/.test(body)) return parenMatch ? s : raw;

  // Safety gate: only digits, decimal point, operators, and parentheses allowed
  if (!/^[0-9+\-*/.()]+$/.test(s)) return raw;

  try {
    const result = safeEval(s);
    if (!isFinite(result)) return raw;
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
