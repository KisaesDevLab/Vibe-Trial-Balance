import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { listUsers } from '../api/users';
import { listPeriods } from '../api/periods';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  getEngagementSummary,
  EngagementTask,
  OpenTaskSummaryItem,
  TaskInput,
  TaskStatus,
  TASK_STATUS_LABELS,
  TASK_CATEGORIES,
  TASK_TEMPLATES,
} from '../api/engagement';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TaskStatus, string> = {
  open:        'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-amber-100 text-amber-700',
  completed:   'bg-green-100 text-green-700',
  n_a:         'bg-gray-100 text-gray-400',
};

const STATUS_ORDER: TaskStatus[] = ['open', 'in_progress', 'review', 'completed', 'n_a'];

function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[status]}`}>
      {TASK_STATUS_LABELS[status]}
    </span>
  );
}

// ── Task Modal ────────────────────────────────────────────────────────────────

interface ModalProps {
  initial?: EngagementTask;
  userOptions: { id: number; display_name: string }[];
  onClose: () => void;
  onSave: (input: TaskInput) => void;
}

function TaskModal({ initial, userOptions, onClose, onSave }: ModalProps) {
  const [title,       setTitle]       = useState(initial?.title ?? '');
  const [category,    setCategory]    = useState(initial?.category ?? '');
  const [status,      setStatus]      = useState<TaskStatus>(initial?.status ?? 'open');
  const [assigneeId,  setAssigneeId]  = useState<string>(initial?.assignee_id ? String(initial.assignee_id) : '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [notes,       setNotes]       = useState(initial?.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      title,
      category:    category || null,
      status,
      assigneeId:  assigneeId ? Number(assigneeId) : null,
      description: description || null,
      notes:       notes || null,
    });
  }

  const inputCls = 'w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-base font-semibold">{initial ? 'Edit Task' : 'Add Task'}</h2>

        <div>
          <label className={labelCls}>Title *</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— None —</option>
              {TASK_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={status} onChange={e => setStatus(e.target.value as TaskStatus)}>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Assignee</label>
          <select className={inputCls} value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
            <option value="">— Unassigned —</option>
            {userOptions.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea className={inputCls} rows={2} value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea className={inputCls} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit"
            className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Templates Modal ───────────────────────────────────────────────────────────

function TemplatesModal({ onClose, onAdd }: { onClose: () => void; onAdd: (items: TaskInput[]) => void }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function handleAdd() {
    const items = [...selected].map(i => ({
      title:    TASK_TEMPLATES[i].title,
      category: TASK_TEMPLATES[i].category,
      status:   'open' as TaskStatus,
    }));
    onAdd(items);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold">Add from Templates</h2>
        <p className="text-xs text-gray-500">Select the tasks to add to this period&apos;s checklist.</p>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {TASK_TEMPLATES.map((t, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm text-gray-800 group-hover:text-teal-700">{t.title}</span>
              <span className="ml-auto text-xs text-gray-400">{t.category}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-between items-center pt-1">
          <button onClick={() => setSelected(new Set(TASK_TEMPLATES.map((_, i) => i)))}
            className="text-xs text-teal-600 hover:underline">Select all</button>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={selected.size === 0}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50">
              Add {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Period Checklist Tab ──────────────────────────────────────────────────────

function ChecklistTab({ periodId }: { periodId: number }) {
  const qc = useQueryClient();
  const [modal, setModal]             = useState<EngagementTask | null | 'new'>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [filterStatus, setFilterStatus]   = useState<TaskStatus | 'all'>('all');

  const { data: taskData } = useQuery({
    queryKey: ['tasks', periodId],
    queryFn:  () => listTasks(periodId),
  });

  const { data: userData } = useQuery({
    queryKey: ['users'],
    queryFn:  listUsers,
  });

  const tasks = taskData?.data ?? [];
  const users = userData?.data ?? [];

  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s).length;
    return acc;
  }, {} as Record<TaskStatus, number>);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks', periodId] });
    qc.invalidateQueries({ queryKey: ['engagement-summary'] });
  };

  const createMut = useMutation({
    mutationFn: (input: TaskInput) => createTask(periodId, input),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const createManyMut = useMutation({
    mutationFn: async (inputs: TaskInput[]) => {
      for (const input of inputs) await createTask(periodId, input);
    },
    onSuccess: () => { invalidate(); setShowTemplates(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<TaskInput> }) => updateTask(id, input),
    onSuccess: () => { invalidate(); setModal(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => invalidate(),
  });

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200';
  const tdCls = 'px-3 py-2 text-sm align-top';

  // Quick status cycle on click
  function cycleStatus(task: EngagementTask) {
    const idx = STATUS_ORDER.indexOf(task.status);
    const nextStatus = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    updateMut.mutate({ id: task.id, input: { status: nextStatus } });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5">
          {(['all', ...STATUS_ORDER] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {s === 'all' ? `All (${tasks.length})` : `${TASK_STATUS_LABELS[s]} (${counts[s]})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowTemplates(true)}
            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium">
            From Templates
          </button>
          <button onClick={() => setModal('new')}
            className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 font-medium">
            + Add Task
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (() => {
        const done = counts.completed + counts.n_a;
        const pct  = Math.round((done / tasks.length) * 100);
        return (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{done} of {tasks.length} complete</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })()}

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className={thCls} style={{ width: 32 }}></th>
              <th className={thCls}>Task</th>
              <th className={thCls}>Category</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Assignee</th>
              <th className={thCls}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">
                  {tasks.length === 0
                    ? 'No tasks yet — click "Add Task" or "From Templates" to get started'
                    : 'No tasks match the selected filter'}
                </td>
              </tr>
            )}
            {filtered.map(task => (
              <tr key={task.id}
                className={`border-t border-gray-100 ${task.status === 'completed' || task.status === 'n_a' ? 'opacity-60' : ''}`}>
                {/* Checkbox-style status toggle */}
                <td className="px-3 py-2 text-center">
                  <button onClick={() => cycleStatus(task)} title="Click to advance status"
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      task.status === 'completed'
                        ? 'bg-teal-500 border-teal-500 text-white'
                        : task.status === 'n_a'
                        ? 'bg-gray-300 border-gray-300 text-white'
                        : 'border-gray-300 hover:border-teal-400'
                    }`}>
                    {(task.status === 'completed' || task.status === 'n_a') && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className={tdCls}>
                  <div className={task.status === 'completed' ? 'line-through text-gray-400' : 'font-medium'}>
                    {task.title}
                  </div>
                  {task.description && <div className="text-xs text-gray-400 mt-0.5">{task.description}</div>}
                  {task.notes       && <div className="text-xs text-gray-400 mt-0.5 italic">{task.notes}</div>}
                  {task.completed_by_name && task.completed_at && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      Completed by {task.completed_by_name} · {new Date(task.completed_at).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td className={tdCls}>
                  {task.category && (
                    <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 rounded-full">{task.category}</span>
                  )}
                </td>
                <td className={tdCls}>
                  <StatusBadge status={task.status} />
                </td>
                <td className={tdCls}>
                  {task.assignee_name
                    ? <span className="text-gray-700">{task.assignee_name}</span>
                    : <span className="text-gray-400 text-xs">Unassigned</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button onClick={() => setModal(task)}
                    className="text-xs text-teal-600 hover:text-teal-800 mr-3">Edit</button>
                  <button onClick={() => { if (confirm('Delete this task?')) deleteMut.mutate(task.id); }}
                    className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal === 'new' && (
        <TaskModal userOptions={users} onClose={() => setModal(null)}
          onSave={input => createMut.mutate(input)} />
      )}
      {modal && modal !== 'new' && (
        <TaskModal initial={modal as EngagementTask} userOptions={users}
          onClose={() => setModal(null)}
          onSave={input => updateMut.mutate({ id: (modal as EngagementTask).id, input })} />
      )}
      {showTemplates && (
        <TemplatesModal onClose={() => setShowTemplates(false)}
          onAdd={items => createManyMut.mutate(items)} />
      )}
    </div>
  );
}

// ── Open Items Tab ────────────────────────────────────────────────────────────

function OpenItemsTab() {
  const { data } = useQuery({
    queryKey: ['engagement-summary'],
    queryFn:  getEngagementSummary,
  });

  const items = data?.data ?? [];

  // Group by client → period
  const byClient = items.reduce((acc, item) => {
    const key = item.client_id;
    if (!acc[key]) acc[key] = { client_name: item.client_name, periods: {} };
    const pk = item.period_id;
    if (!acc[key].periods[pk]) acc[key].periods[pk] = { period_name: item.period_name, tasks: [] };
    acc[key].periods[pk].tasks.push(item);
    return acc;
  }, {} as Record<number, { client_name: string; periods: Record<number, { period_name: string; tasks: OpenTaskSummaryItem[] }> }>);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No open items across any client — all caught up!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">{items.length} open item{items.length !== 1 ? 's' : ''} across all clients</p>
      {Object.entries(byClient).map(([clientId, { client_name, periods }]) => (
        <div key={clientId} className="space-y-3">
          <h3 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-1">{client_name}</h3>
          {Object.entries(periods).map(([periodId, { period_name, tasks }]) => (
            <div key={periodId} className="pl-3 space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{period_name}</div>
              {tasks.map(task => (
                <div key={task.id} className="flex items-start gap-3 py-1.5 border-b border-gray-100">
                  <StatusBadge status={task.status} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-800">{task.title}</span>
                    {task.category && (
                      <span className="ml-2 text-xs text-gray-400">{task.category}</span>
                    )}
                  </div>
                  {task.assignee_name && (
                    <span className="text-xs text-gray-500 shrink-0">{task.assignee_name}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'checklist' | 'open-items';

export function EngagementPage() {
  const [tab, setTab] = useState<Tab>('checklist');
  const { selectedClientId, selectedPeriodId } = useUIStore();

  const { data: periodsData } = useQuery({
    queryKey: ['periods', selectedClientId],
    queryFn:  () => listPeriods(selectedClientId!),
    enabled:  !!selectedClientId,
  });

  const period = periodsData?.data?.find(p => p.id === selectedPeriodId);

  const tabBtn = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-teal-600 text-teal-700'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Engagement</h1>
        {tab === 'checklist' && period && (
          <p className="text-sm text-gray-500 mt-0.5">{period.period_name} checklist</p>
        )}
      </div>

      <div className="border-b border-gray-200 flex gap-1">
        <button className={tabBtn('checklist')}  onClick={() => setTab('checklist')}>
          Period Checklist
        </button>
        <button className={tabBtn('open-items')} onClick={() => setTab('open-items')}>
          All Open Items
        </button>
      </div>

      {tab === 'checklist' && (
        selectedPeriodId
          ? <ChecklistTab periodId={selectedPeriodId} />
          : <div className="py-8 text-center text-gray-400 text-sm">Select a client and period to view the checklist.</div>
      )}
      {tab === 'open-items' && <OpenItemsTab />}
    </div>
  );
}
