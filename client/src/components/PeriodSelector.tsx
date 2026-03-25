import { useQuery } from '@tanstack/react-query';
import { listPeriods } from '../api/periods';
import { useUIStore } from '../store/uiStore';

export function PeriodSelector() {
  const { selectedClientId, selectedPeriodId, setSelectedPeriodId } = useUIStore();

  const { data, isLoading } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await listPeriods(selectedClientId);
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    enabled: selectedClientId !== null,
  });

  if (!selectedClientId) return null;
  if (isLoading) return <div className="text-xs text-gray-400">Loading periods...</div>;

  const periods = data ?? [];

  return (
    <div>
      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">
        Period
      </label>
      <select
        value={selectedPeriodId ?? ''}
        onChange={(e) => setSelectedPeriodId(e.target.value ? Number(e.target.value) : null)}
        className="w-full bg-gray-800 text-white text-sm border border-gray-700 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
      >
        <option value="">Select period...</option>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.period_name}{p.is_current ? ' ★' : ''}
          </option>
        ))}
      </select>
      {periods.length === 0 && (
        <p className="text-xs text-gray-500 mt-1">No periods yet.</p>
      )}
    </div>
  );
}
