import { apiFetch } from './client';

export interface ModelPricing {
  input: number;  // $ per million tokens
  output: number;
}

export interface AiPricingMap {
  [model: string]: ModelPricing;
}

export interface AiUsageRow {
  month: string;
  model: string;
  calls: string;
  input_tokens: string;
  output_tokens: string;
  estimated_cost_usd: string | null;
}

export async function getAiPricing(): Promise<AiPricingMap> {
  const res = await apiFetch<AiPricingMap>('/settings/ai-pricing');
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function saveAiPricing(pricing: AiPricingMap): Promise<void> {
  const res = await apiFetch<{ saved: boolean }>('/settings/ai-pricing', {
    method: 'PUT',
    body: JSON.stringify(pricing),
  });
  if (res.error) throw new Error(res.error.message);
}

export async function fetchAiPricingFromClaude(): Promise<AiPricingMap> {
  const res = await apiFetch<AiPricingMap>('/settings/ai-pricing/fetch', { method: 'POST' });
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function getAiUsage(): Promise<AiUsageRow[]> {
  const res = await apiFetch<AiUsageRow[]>('/settings/ai-usage');
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export interface AiUsageDetailRow {
  id: number;
  created_at: string;
  endpoint: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: string | null;
  user_id: number | null;
  client_id: number | null;
  username: string | null;
  client_name: string | null;
}

export interface AiUsageDetailParams {
  page?: number;
  limit?: number;
  endpoint?: string;
  model?: string;
  userId?: number;
  from?: string;
  to?: string;
}

export interface AiUsageDetailMeta {
  total: number;
  page: number;
  limit: number;
}

export async function getAiUsageDetail(params: AiUsageDetailParams = {}): Promise<{ data: AiUsageDetailRow[]; meta: AiUsageDetailMeta }> {
  const qs = new URLSearchParams();
  if (params.page)     qs.set('page',     String(params.page));
  if (params.limit)    qs.set('limit',    String(params.limit));
  if (params.endpoint) qs.set('endpoint', params.endpoint);
  if (params.model)    qs.set('model',    params.model);
  if (params.userId)   qs.set('userId',   String(params.userId));
  if (params.from)     qs.set('from',     params.from);
  if (params.to)       qs.set('to',       params.to);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const res = await apiFetch<AiUsageDetailRow[]>(`/settings/ai-usage/detail${query}`);
  if (res.error) throw new Error(res.error.message);
  const withMeta = res as unknown as { data: AiUsageDetailRow[]; error: null; meta: AiUsageDetailMeta };
  return { data: withMeta.data, meta: withMeta.meta };
}

export interface AiModels {
  fastModel: string;
  primaryModel: string;
}

export async function getAiModels(): Promise<AiModels> {
  const res = await apiFetch<AiModels>('/settings/ai-models');
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export async function saveAiModels(models: Partial<AiModels>): Promise<void> {
  const res = await apiFetch<{ saved: boolean }>('/settings/ai-models', {
    method: 'PUT',
    body: JSON.stringify(models),
  });
  if (res.error) throw new Error(res.error.message);
}

export interface AvailableModel {
  id: string;
  displayName: string;
}

export async function getAvailableModels(): Promise<AvailableModel[]> {
  const res = await apiFetch<AvailableModel[]>('/settings/ai-models/available');
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
