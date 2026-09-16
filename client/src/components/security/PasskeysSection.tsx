// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../Modal';
import { PasskeyRegisterFlow } from '../auth/PasskeyRegisterFlow';
import { PasswordConfirmDialog } from '../auth/PasswordConfirmDialog';
import { SECURITY_QUERY_KEY, deletePasskey, renamePasskey, type PasskeyInfo, type TwoFactorStatus } from '../../api/security';
import { pushToast, useAuthStore } from '../../store/uiStore';

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : 'never');

function PasskeyRow({ pk, canRemove, onRemove }: { pk: PasskeyInfo; canRemove: boolean; onRemove: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pk.name);

  const save = async () => {
    const v = name.trim();
    setEditing(false);
    if (!v || v === pk.name) { setName(pk.name); return; }
    const res = await renamePasskey(pk.id, v);
    if (res.error) { pushToast(res.error.message, 'error'); setName(pk.name); return; }
    void qc.invalidateQueries({ queryKey: SECURITY_QUERY_KEY });
  };

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') { setName(pk.name); setEditing(false); } }}
            maxLength={64}
            autoFocus
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 dark:text-white"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} title="Rename" className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:underline truncate">
            {pk.name}
          </button>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Added {fmt(pk.createdAt)} · Last used {fmt(pk.lastUsedAt)}{pk.backedUp ? ' · Synced' : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        title={canRemove ? undefined : 'Set up an authenticator app or another passkey first — your firm requires a second factor.'}
        className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        Remove
      </button>
    </li>
  );
}

export function PasskeysSection({ status }: { status: TwoFactorStatus }) {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const updateUser = useAuthStore((s) => s.updateUser);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PasskeyInfo | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: SECURITY_QUERY_KEY });

  const canRemove = !(status.requireTwoFactor && !status.totpEnabled && status.passkeys.length <= 1);

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Passkeys</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        A passkey signs you in with your fingerprint, face or device PIN — no password or code.
      </p>
      {status.passkeys.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">No passkeys yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700 mb-3 max-w-md">
          {status.passkeys.map((pk) => (
            <PasskeyRow key={pk.id} pk={pk} canRemove={canRemove} onRemove={() => setRemoving(pk)} />
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        Add passkey
      </button>
      {!status.passkeysAvailable && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {status.passkeyBlockReason}{isAdmin ? ' Set the public app URL under Sign-in security below.' : ''}
        </p>
      )}

      {adding && (
        <Modal title="Add a passkey" onClose={() => setAdding(false)}>
          <PasskeyRegisterFlow
            passkeysAvailable={status.passkeysAvailable}
            passkeyBlockReason={status.passkeyBlockReason}
            adminHint={isAdmin}
            onCancel={() => setAdding(false)}
            onDone={({ user }) => {
              setAdding(false);
              updateUser({ mustEnrolTwoFactor: false, twoFactor: user.twoFactor });
              pushToast('Passkey added.', 'success');
              void refresh();
            }}
          />
        </Modal>
      )}
      {removing && (
        <PasswordConfirmDialog
          title="Remove passkey"
          message={`Remove "${removing.name}"? You will no longer be able to sign in with it.`}
          confirmLabel="Remove"
          onConfirm={(pw) => deletePasskey(removing.id, pw).then((r) => { if (!r.error) { pushToast('Passkey removed.', 'success'); void refresh(); } return r; })}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
