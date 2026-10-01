// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Rewrites the database ids INSIDE a statement layout when a backup is
 * restored.
 *
 * A layout is JSON, so the restore's id remapping — which works column by
 * column — cannot see into it. Left alone, a layout restored as a new client
 * would still name the ORIGINAL client's accounts and lead sheets: at best
 * the lines resolve to nothing, at worst (same instance, ids still live) they
 * resolve to another client's accounts.
 *
 * Ids appear in four places:
 *   - a lead sheet line's `ref.groupingId`
 *   - a lead sheet line's `scheduleLines[].accountRefs[].accountId`
 *   - an account line's `refs[].accountId`
 *   - the equity statement's `columnCaptions`, keyed by account id
 *
 * What cannot be mapped is dropped, never kept:
 *   - a lead sheet id falls back to the line's `leadsheetCode`, which the
 *     engine resolves against the client's own lead sheets (and reports as
 *     TB_FS_UNBOUND_LEADSHEET when there is no such code);
 *   - an account line left with no accounts is removed, and the totals and
 *     rounding plugs that named it are scrubbed, so the layout stays valid.
 *
 * Pure, and tolerant of a layout it does not fully recognise (an archive may
 * predate a field): anything that is not a known id is passed through.
 */

export interface FsIdMaps {
  /** Old account id → new account id, or undefined when it was not restored. */
  account: (oldId: number) => number | undefined;
  leadSheet: (oldId: number) => number | undefined;
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

function mapId(id: unknown, map: (old: number) => number | undefined): string | null {
  const n = Number(id);
  // '-1' is the virtual retained-earnings account: not a row, never remapped.
  if (id === '-1' || n === -1) return '-1';
  if (!Number.isInteger(n) || n <= 0) return null;
  const mapped = map(n);
  return mapped === undefined ? null : String(mapped);
}

function mapRefs(refs: unknown, maps: FsIdMaps): Array<{ accountId: string }> {
  if (!Array.isArray(refs)) return [];
  const out: Array<{ accountId: string }> = [];
  for (const r of refs) {
    if (!isObj(r)) continue;
    const id = mapId(r.accountId, maps.account);
    if (id !== null) out.push({ accountId: id });
  }
  return out;
}

function remapNodes(nodes: unknown, maps: FsIdMaps, removed: Set<string>): unknown[] {
  if (!Array.isArray(nodes)) return [];
  const out: unknown[] = [];
  for (const n of nodes) {
    if (!isObj(n)) { out.push(n); continue; }
    if (n.type === 'section') {
      out.push({ ...n, children: remapNodes(n.children, maps, removed) });
    } else if (n.type === 'account') {
      const refs = mapRefs(n.refs, maps);
      if (!refs.length) { removed.add(String(n.id)); continue; }
      out.push({ ...n, refs });
    } else if (n.type === 'leadsheet') {
      const ref = isObj(n.ref) ? { ...n.ref } : {};
      const groupingId = ref.groupingId === undefined ? null : mapId(ref.groupingId, maps.leadSheet);
      if (groupingId === null) delete ref.groupingId; else ref.groupingId = groupingId;
      const next: Json = { ...n, ref };
      if (Array.isArray(n.scheduleLines)) {
        const lines = n.scheduleLines
          .filter(isObj)
          .map((l) => ({ ...l, accountRefs: mapRefs(l.accountRefs, maps) }))
          .filter((l) => l.accountRefs.length > 0);
        if (lines.length) next.scheduleLines = lines; else delete next.scheduleLines;
      }
      // A line with neither an id nor a code has nothing left to bind to.
      if (ref.groupingId === undefined && !ref.leadsheetCode) { removed.add(String(n.id)); continue; }
      out.push(next);
    } else {
      out.push(n);
    }
  }
  return out;
}

function scrub(nodes: unknown[], removed: Set<string>): unknown[] {
  return nodes.map((n) => {
    if (!isObj(n)) return n;
    if (n.type === 'section') return { ...n, children: scrub(Array.isArray(n.children) ? n.children : [], removed) };
    if (n.type === 'total' && Array.isArray(n.terms)) {
      return { ...n, terms: n.terms.filter((t) => !(isObj(t) && removed.has(String(t.nodeId)))) };
    }
    return n;
  });
}

export function remapFsLayoutIds(layout: unknown, maps: FsIdMaps): unknown {
  if (!isObj(layout) || !Array.isArray(layout.statements)) return layout;
  const statements = layout.statements.map((st) => {
    if (!isObj(st)) return st;
    const removed = new Set<string>();
    const body = scrub(remapNodes(st.body, maps, removed), removed);
    const next: Json = { ...st, body };
    if (isObj(st.plugs)) {
      next.plugs = Object.fromEntries(Object.entries(st.plugs).filter(([k, v]) => !removed.has(k) && !removed.has(String(v))));
    }
    if (isObj(st.equity) && isObj(st.equity.columnCaptions)) {
      const captions: Json = {};
      for (const [k, v] of Object.entries(st.equity.columnCaptions)) {
        // 'all' is the single-column key; everything else is an account id.
        const key = k === 'all' ? k : mapId(k, maps.account);
        if (key !== null) captions[key] = v;
      }
      next.equity = { ...st.equity, columnCaptions: captions };
    }
    return next;
  });
  return { ...layout, statements };
}
