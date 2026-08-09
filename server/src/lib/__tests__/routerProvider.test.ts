// Copyright 2025-2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Use is limited to qualifying small businesses. See LICENSE for terms.

/**
 * RouterLLMProvider unit tests (MIG-1) — wire contract via injected fetch, no
 * network. Run: npx tsx --test src/lib/__tests__/routerProvider.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RouterLLMProvider, TB_TASK_CLASSES, validateAiModeEnv, registerTbTaskClasses } from '../routerProvider';
import type { LLMParams } from '../llmProvider';

const BASE = { baseUrl: 'http://router.test:8220', token: 'tok_test' };

function completionResponse(body?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      model: 'qwen3:32b',
      choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
      ...body,
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req_1' } },
  );
}

function captureFetch(response: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response();
  }) as typeof fetch;
  return { calls, fn };
}

const PARAMS: LLMParams = {
  model: 'vibe-router',
  taskClass: TB_TASK_CLASSES.CLASSIFICATION,
  maxTokens: 2048,
  system: 'sys',
  messages: [{ role: 'user', content: 'classify this' }],
  userId: 42,
  clientId: 7,
  userRole: 'reviewer',
  engagementRef: '12',
};

test('complete(): task-class header, attribution, and NO app-pinned model on the wire', async () => {
  const { calls, fn } = captureFetch(completionResponse);
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  const result = await provider.complete(PARAMS);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://router.test:8220/v1/chat/completions');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['x-vibe-task-class'], 'tb_classification');
  assert.equal(headers['x-vibe-user'], '42');
  assert.equal(headers['x-vibe-client'], '7');
  assert.equal(headers['x-vibe-user-role'], 'partner', "app role 'reviewer' maps to router 'partner'");
  assert.equal(headers['x-vibe-engagement'], '12');
  assert.equal(headers.authorization, 'Bearer tok_test');

  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.model, undefined, 'model choice belongs to router policy, never the app');
  assert.equal(body.max_tokens, 2048);
  assert.deepEqual(body.messages[0], { role: 'system', content: 'sys' });

  assert.equal(result.text, 'hello');
  assert.equal(result.inputTokens, 11);
  assert.equal(result.outputTokens, 7);
  assert.equal(result.stopReason, 'stop');
  assert.equal(result.servedModel, 'qwen3:32b');
});

test('complete(): app roles map onto the router role union, least privilege for unknowns', async () => {
  const cases: [string, string][] = [
    ['admin', 'admin'],
    ['reviewer', 'partner'],
    ['preparer', 'staff'],
    ['bogus_future_role', 'staff'],
  ];
  for (const [appRole, routerRole] of cases) {
    const { calls, fn } = captureFetch(completionResponse);
    const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
    await provider.complete({ ...PARAMS, userRole: appRole });
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers['x-vibe-user-role'], routerRole, `${appRole} → ${routerRole}`);
  }
});

test('complete(): absent userRole/engagementRef emit no attribution headers', async () => {
  const { calls, fn } = captureFetch(completionResponse);
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  await provider.complete({ ...PARAMS, userRole: null, engagementRef: null });
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['x-vibe-user-role'], undefined);
  assert.equal(headers['x-vibe-engagement'], undefined);
});

test('complete(): image parts become data-URL image_url content', async () => {
  const { calls, fn } = captureFetch(completionResponse);
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  await provider.complete({
    ...PARAMS,
    taskClass: TB_TASK_CLASSES.DOC_EXTRACT,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'extract' },
        { type: 'image', base64: 'QUJD', mimeType: 'image/png' },
      ],
    }],
  });
  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.messages[1].content[1], {
    type: 'image_url',
    image_url: { url: 'data:image/png;base64,QUJD' },
  });
});

test('complete(): fails closed when a call site declares no task class', async () => {
  const { fn } = captureFetch(completionResponse);
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  await assert.rejects(
    provider.complete({ ...PARAMS, taskClass: undefined }),
    /did not declare a task class/,
  );
});

test('complete(): router error surfaces with code — and never falls back', async () => {
  const { fn } = captureFetch(() =>
    new Response(JSON.stringify({ error: { code: 'policy_blocked', message: 'no policy for task class' } }), { status: 403 }),
  );
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  await assert.rejects(provider.complete(PARAMS), /Vibe AI Router: no policy for task class \(policy_blocked\)/);
});

test('complete(): network failure names the router, not a fallback', async () => {
  const fn = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  await assert.rejects(provider.complete(PARAMS), /Vibe AI Router unreachable.*never falls back/s);
});

function sseResponse(events: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const e of events) controller.enqueue(enc.encode(e));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('stream(): yields deltas and returns usage from the final event', async () => {
  const { calls, fn } = captureFetch(() =>
    sseResponse([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\n',
      'data: [DONE]\n\n',
    ]),
  );
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  const gen = provider.stream({ ...PARAMS, taskClass: TB_TASK_CLASSES.SUPPORT_CHAT });
  let text = '';
  let chunk = await gen.next();
  while (!chunk.done) {
    text += chunk.value;
    chunk = await gen.next();
  }
  assert.equal(text, 'Hello');
  assert.deepEqual(chunk.value, { inputTokens: 5, outputTokens: 2 });

  // Streaming rides the same attribution as complete() — support chat is a
  // stream call site, so role gating must hold here too.
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['x-vibe-task-class'], 'tb_support_chat');
  assert.equal(headers['x-vibe-user'], '42');
  assert.equal(headers['x-vibe-user-role'], 'partner');
  assert.equal(headers['x-vibe-engagement'], '12');
  assert.equal(headers['x-vibe-client'], '7');
});

test('stream(): consumer bailing out aborts the upstream request', async () => {
  let upstreamSignal: AbortSignal | undefined;
  const fn = (async (_url: unknown, init?: RequestInit) => {
    upstreamSignal = init?.signal ?? undefined;
    // A stream that never closes on its own — only abort ends it.
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n'));
      },
    });
    return new Response(stream, { status: 200 });
  }) as typeof fetch;

  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  const gen = provider.stream({ ...PARAMS, taskClass: TB_TASK_CLASSES.SUPPORT_CHAT });
  const first = await gen.next();
  assert.equal(first.value, 'x');
  await gen.return(undefined as never); // client disconnected
  assert.ok(upstreamSignal, 'driver must pass an abort signal upstream');
  assert.equal(upstreamSignal.aborted, true, 'bail-out must abort upstream (orphaned streams burn tokens)');
});

test('healthCheck(): GET /healthz, throws on non-200', async () => {
  const { calls, fn } = captureFetch(() => new Response('{"status":"ok"}', { status: 200 }));
  const provider = new RouterLLMProvider({ ...BASE, fetch: fn });
  await provider.healthCheck();
  assert.equal(calls[0].url, 'http://router.test:8220/healthz');

  const bad = new RouterLLMProvider({ ...BASE, fetch: (async () => new Response('', { status: 503 })) as typeof fetch });
  await assert.rejects(bad.healthCheck(), /health check failed: HTTP 503/);
});

test('validateAiModeEnv(): router mode refuses to boot without URL + token', () => {
  const saved = { ...process.env };
  try {
    delete process.env.VIBE_AI_ROUTER_URL;
    delete process.env.VIBE_AI_TOKEN;
    process.env.VIBE_AI_MODE = 'router';
    assert.match(validateAiModeEnv() ?? '', /requires both VIBE_AI_ROUTER_URL and VIBE_AI_TOKEN/);

    process.env.VIBE_AI_ROUTER_URL = 'http://vibe-ai-router:8220';
    assert.match(validateAiModeEnv() ?? '', /requires both/);

    process.env.VIBE_AI_TOKEN = 'tok';
    assert.equal(validateAiModeEnv(), null);

    process.env.VIBE_AI_MODE = 'sideways';
    assert.match(validateAiModeEnv() ?? '', /must be "direct" or "router"/);

    delete process.env.VIBE_AI_MODE;
    assert.equal(validateAiModeEnv(), null);
  } finally {
    process.env.VIBE_AI_MODE = saved.VIBE_AI_MODE;
    process.env.VIBE_AI_ROUTER_URL = saved.VIBE_AI_ROUTER_URL;
    process.env.VIBE_AI_TOKEN = saved.VIBE_AI_TOKEN;
    if (saved.VIBE_AI_MODE === undefined) delete process.env.VIBE_AI_MODE;
    if (saved.VIBE_AI_ROUTER_URL === undefined) delete process.env.VIBE_AI_ROUTER_URL;
    if (saved.VIBE_AI_TOKEN === undefined) delete process.env.VIBE_AI_TOKEN;
  }
});

test('registerTbTaskClasses(): declares all six vibe-tb classes, router mode only', async () => {
  const saved = { ...process.env };
  try {
    process.env.VIBE_AI_MODE = 'router';
    process.env.VIBE_AI_ROUTER_URL = 'http://router.test:8220';
    process.env.VIBE_AI_TOKEN = 'tok_test';

    const { calls, fn } = captureFetch(() =>
      new Response(JSON.stringify({ registered: [] }), { status: 200 }),
    );
    registerTbTaskClasses({ fetch: fn, maxAttempts: 1 });
    await new Promise((r) => setTimeout(r, 50)); // registration is fire-and-forget

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://router.test:8220/v1/task-classes/register');
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.app, 'vibe-tb');
    assert.deepEqual(
      body.classes.map((c: { key: string }) => c.key).sort(),
      ['tb_bank_statement_extract', 'tb_classification', 'tb_diagnostics', 'tb_doc_extract', 'tb_research_summary', 'tb_support_chat'],
    );
    const bank = body.classes.find((c: { key: string }) => c.key === 'tb_bank_statement_extract');
    assert.deepEqual(bank.requires, { json_schema: true, vision: true });
    assert.equal(bank.defaultMaxTokens, 32768);

    // direct mode: no registration traffic at all
    process.env.VIBE_AI_MODE = 'direct';
    registerTbTaskClasses({ fetch: fn, maxAttempts: 1 });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(calls.length, 1);
  } finally {
    for (const k of ['VIBE_AI_MODE', 'VIBE_AI_ROUTER_URL', 'VIBE_AI_TOKEN'] as const) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
