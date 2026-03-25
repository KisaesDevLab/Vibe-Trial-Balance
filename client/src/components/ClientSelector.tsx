import { useQuery } from '@tanstack/react-query';
import { listClients } from '../api/clients';
import { useUIStore } from '../store/uiStore';

export function ClientSelector() {
  const { selectedClientId, setSelectedClientId } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await listClients();
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
  });

  if (isLoading) {
    return <div className="text-xs text-gray-400">Loading clients...</div>;
  }

  const clients = data ?? [];

  return (
    <div>
      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
        Client
      </label>
      <select
        value={selectedClientId ?? ''}
        onChange={(e) => setSelectedClientId(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-gray-800 text-white text-sm border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
      >
        <option value="">Select client...</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
      {clients.length === 0 && (
        <p className="text-xs text-gray-500 mt-1">No clients yet.</p>
      )}
    </div>
  );
}
