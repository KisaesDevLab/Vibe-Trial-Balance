import { apiFetch } from './client';

export type TaskStatus = 'open' | 'in_progress' | 'review' | 'completed' | 'n_a';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open:        'Open',
  in_progress: 'In Progress',
  review:      'Ready for Review',
  completed:   'Completed',
  n_a:         'N/A',
};

export const TASK_CATEGORIES = [
  'Bank Reconciliation',
  'Accounts Receivable',
  'Accounts Payable',
  'Payroll',
  'Fixed Assets',
  'Tax Preparation',
  'Tax Review',
  'Financial Statements',
  'Trial Balance Review',
  'Partner Sign-off',
  'Other',
] as const;

export const TASK_TEMPLATES: { title: string; category: string }[] = [
  { title: 'Bank accounts reconciled',         category: 'Bank Reconciliation' },
  { title: 'Accounts receivable reconciled',   category: 'Accounts Receivable' },
  { title: 'Accounts payable reconciled',      category: 'Accounts Payable' },
  { title: 'Payroll reconciled to W-3',        category: 'Payroll' },
  { title: 'Trial balance reviewed',           category: 'Trial Balance Review' },
  { title: 'Financial statements prepared',    category: 'Financial Statements' },
  { title: 'Financial statements reviewed',    category: 'Financial Statements' },
  { title: 'Tax return prepared',              category: 'Tax Preparation' },
  { title: 'Tax return reviewed',              category: 'Tax Review' },
  { title: 'Partner sign-off obtained',        category: 'Partner Sign-off' },
];

export interface EngagementTask {
  id: number;
  period_id: number;
  title: string;
  description: string | null;
  category: string | null;
  status: TaskStatus;
  assignee_id: number | null;
  assignee_name: string | null;
  sort_order: number;
  notes: string | null;
  completed_by: number | null;
  completed_by_name: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface OpenTaskSummaryItem {
  id: number;
  title: string;
  category: string | null;
  status: TaskStatus;
  notes: string | null;
  period_id: number;
  period_name: string;
  end_date: string | null;
  client_id: number;
  client_name: string;
  assignee_id: number | null;
  assignee_name: string | null;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  category?: string | null;
  status?: TaskStatus;
  assigneeId?: number | null;
  sortOrder?: number;
  notes?: string | null;
}

export const listTasks = (periodId: number) =>
  apiFetch<EngagementTask[]>(`/periods/${periodId}/engagement-tasks`);

export const createTask = (periodId: number, input: TaskInput) =>
  apiFetch<EngagementTask>(`/periods/${periodId}/engagement-tasks`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateTask = (id: number, input: Partial<TaskInput>) =>
  apiFetch<EngagementTask>(`/engagement-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteTask = (id: number) =>
  apiFetch<{ id: number }>(`/engagement-tasks/${id}`, { method: 'DELETE' });

export const getEngagementSummary = () =>
  apiFetch<OpenTaskSummaryItem[]>('/engagement-summary');
