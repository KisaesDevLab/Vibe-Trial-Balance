import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  type AppUser,
  type UserInput,
  type UserPatch,
} from '../api/users';
import { useAuthStore } from '../store/uiStore';

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin:    { label: 'Admin',    cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400' },
  reviewer: { label: 'Reviewer', cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400' },
  preparer: { label: 'Preparer', cls: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' },
};

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-base font-semibold dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

interface UserFormProps {
  initial?: Partial<UserInput & { isActive: boolean }>;
  isEdit?: boolean;
  onSave: (data: UserInput | UserPatch) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

function UserForm({ initial, isEdit, onSave, onCancel, saving, error }: UserFormProps) {
  const [username, setUsername] = useState(initial?.username ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserInput['role']>(initial?.role ?? 'preparer');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      const patch: UserPatch = { displayName, role };
      if (password) patch.password = password;
      onSave(patch);
    } else {
      onSave({ username, displayName, password, role });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>}
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required autoFocus={isEdit}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
        </label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          required={!isEdit} minLength={6}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value as UserInput['role'])}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
          <option value="preparer">Preparer</option>
          <option value="reviewer">Reviewer</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-gray-300">Cancel</button>
        <button type="submit" disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await listUsers();
      if (res.error) throw new Error(res.error.message);
      return res.data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: (input: UserInput) => createUser(input),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidate(); setShowAdd(false); setFormError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: UserPatch }) => updateUser(id, patch),
    onSuccess: (res) => {
      if (res.error) { setFormError(res.error.message); return; }
      invalidate(); setEditUser(null); setFormError(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => invalidate(),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => updateUser(id, { isActive: true }),
    onSuccess: () => invalidate(),
  });

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm mt-1">User management requires admin access.</p>
        </div>
      </div>
    );
  }

  const users = data ?? [];
  const active   = users.filter((u) => u.is_active);
  const inactive = users.filter((u) => !u.is_active);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">{active.length} active{inactive.length > 0 ? `, ${inactive.length} inactive` : ''}</p>
        </div>
        <button onClick={() => { setShowAdd(true); setFormError(null); }}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
          + Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded text-sm mb-4">{error.message}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500">Loading…</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Username</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">No users found.</td></tr>
              ) : (
                users.map((u) => {
                  const badge = ROLE_BADGE[u.role] ?? ROLE_BADGE.preparer;
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                        {u.display_name}
                        {isSelf && <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">(you)</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-gray-600 dark:text-gray-400">{u.username}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {u.is_active
                          ? <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
                          : <span className="text-xs text-gray-400 dark:text-gray-500">Inactive</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => { setEditUser(u); setFormError(null); }}
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mr-3">
                          Edit
                        </button>
                        {u.is_active && !isSelf ? (
                          <button
                            onClick={() => { if (confirm(`Deactivate "${u.display_name}"?`)) deactivateMutation.mutate(u.id); }}
                            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
                            Deactivate
                          </button>
                        ) : !u.is_active ? (
                          <button onClick={() => reactivateMutation.mutate(u.id)}
                            className="text-xs text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300">
                            Reactivate
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <UserForm
            onSave={(data) => createMutation.mutate(data as UserInput)}
            onCancel={() => setShowAdd(false)}
            saving={createMutation.isPending}
            error={formError}
          />
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit — ${editUser.display_name}`} onClose={() => setEditUser(null)}>
          <UserForm
            isEdit
            initial={{ username: editUser.username, displayName: editUser.display_name, role: editUser.role }}
            onSave={(data) => updateMutation.mutate({ id: editUser.id, patch: data as UserPatch })}
            onCancel={() => setEditUser(null)}
            saving={updateMutation.isPending}
            error={formError}
          />
        </Modal>
      )}
    </div>
  );
}
