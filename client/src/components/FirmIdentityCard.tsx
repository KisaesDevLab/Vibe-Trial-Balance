// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * Settings → Firm identity (admin). `firm_name` / `firm_address` have been
 * printed on every PDF header since Plan Phase 6 but had no UI; they and the
 * new `firm_email` also name the operator on the public /privacy and /terms
 * pages that Intuit's production checklist points at.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFirmIdentity, saveFirmIdentity, type FirmIdentity } from '../api/legal';
import { pushToast } from '../store/uiStore';
import { withBase } from '../lib/baseConfig';

const inputCls =
  'w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white';

export function FirmIdentityCard() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['firm-identity'],
    queryFn: async () => {
      const res = await getFirmIdentity();
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
  });

  const [form, setForm] = useState<FirmIdentity>({ name: '', address: '', email: '' });
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await saveFirmIdentity({ name: form.name.trim(), address: form.address.trim(), email: form.email.trim() });
      if (res.error) throw new Error(res.error.message);
      return res.data!;
    },
    onSuccess: () => {
      pushToast('Firm identity saved', 'success');
      qc.invalidateQueries({ queryKey: ['firm-identity'] });
    },
    onError: (e: Error) => pushToast(e.message, 'error'),
  });

  const dirty = !!query.data && (query.data.name !== form.name || query.data.address !== form.address || query.data.email !== form.email);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Firm identity</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Printed in the header of every PDF, and names the firm as the operator on the public{' '}
        <a href={withBase('/privacy')} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</a> and{' '}
        <a href={withBase('/terms')} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">End-User License Agreement</a> pages
        that Intuit requires for QuickBooks production access.
      </p>
      {query.isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : query.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{(query.error as Error).message}</p>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="space-y-3 max-w-lg"
        >
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Firm name</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} placeholder="Smith & Jones CPAs" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Address</label>
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={1000} placeholder="123 Main St, Suite 4, Springfield, IL 62701" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Contact email (public pages only)</label>
            <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={254} placeholder="office@example.com" />
          </div>
          <button
            type="submit"
            disabled={save.isPending || !dirty}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}
    </div>
  );
}
