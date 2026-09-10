/**
 * One import alias, one account.
 *
 * Alias writes used to be append-only and never revoked, so the same text could
 * accumulate on several accounts. The matcher scans the chart of accounts in
 * account-number order and takes the first hit, so only the lowest-numbered
 * holder was ever reachable — every other copy was dead weight that could
 * surface later if that account was renumbered or deactivated.
 *
 * This keeps the copy on the LOWEST account number, which is exactly the one
 * the matcher already chose, so no import changes its behaviour today. It also
 * folds case-variant duplicates within a single account ("Cash" and "cash",
 * which the case-sensitive writers allowed but the case-insensitive matcher
 * could never tell apart) and drops any alias equal to its own account's name.
 *
 * No down migration restores the removed copies: they were unreachable, and
 * re-creating ambiguity is not a state worth returning to.
 */

exports.up = async function up(knex) {
  const clients = await knex('clients').select('id');

  for (const { id: clientId } of clients) {
    const accounts = await knex('chart_of_accounts')
      .where({ client_id: clientId })
      .orderBy('account_number', 'asc')
      .select('id', 'account_number', 'account_name', 'import_aliases');

    const claimed = new Set(); // normalized alias -> already taken by an earlier account

    for (const acct of accounts) {
      const raw = acct.import_aliases;
      let list = [];
      if (Array.isArray(raw)) list = raw.filter((v) => typeof v === 'string');
      else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed.filter((v) => typeof v === 'string');
        } catch { list = []; }
      }
      if (list.length === 0) continue;

      const ownName = String(acct.account_name ?? '').trim().toLowerCase();
      const kept = [];
      const seenHere = new Set();

      for (const alias of list) {
        const key = String(alias).trim().toLowerCase();
        if (key === '') continue;
        if (key === ownName) continue;      // an account is not its own alias
        if (seenHere.has(key)) continue;    // case-variant duplicate on this account
        if (claimed.has(key)) continue;     // a lower account number already holds it
        seenHere.add(key);
        kept.push(alias);
      }

      for (const key of seenHere) claimed.add(key);

      const changed =
        kept.length !== list.length || kept.some((a, i) => a !== list[i]);
      if (changed) {
        await knex('chart_of_accounts')
          .where({ id: acct.id })
          .update({ import_aliases: JSON.stringify(kept) });
      }
    }
  }
};

exports.down = async function down() {
  // Intentionally empty — see the header.
};
