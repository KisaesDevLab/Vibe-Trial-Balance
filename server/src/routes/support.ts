import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logAiUsage } from '../lib/aiUsage';
import { getLLMProvider } from '../lib/aiClient';

export const supportRouter = Router();
supportRouter.use(authMiddleware);

async function loadKnowledgeBase(): Promise<string> {
  const knowledgeDir = path.resolve(__dirname, '../../knowledge');
  let combined = '';
  try {
    const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(knowledgeDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const title = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      combined += `\n\n## Knowledge: ${title}\n\n${content}`;
    }
  } catch (err: unknown) {
    console.warn('[support] Knowledge base load failed:', err instanceof Error ? err.message : String(err));
    combined = '(Knowledge base unavailable)';
  }
  return combined;
}

// POST /api/v1/support/chat — SSE streaming
supportRouter.post('/chat', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }

  const { conversationId: incomingConvId, message } = req.body as {
    conversationId?: number | null;
    message: string;
  };

  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'message is required' } });
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const writeEvent = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Determine or create conversation
    let conversationId: number = incomingConvId ?? 0;
    if (!conversationId) {
      const [newConv] = await db('support_conversations')
        .insert({
          user_id: userId,
          title: message.trim().slice(0, 60),
          is_bookmarked: false,
        })
        .returning('id');
      conversationId = typeof newConv === 'object' && newConv !== null ? (newConv as { id: number }).id : Number(newConv);
    }

    // Emit start event with conversationId
    writeEvent({ type: 'start', conversationId });

    // Load prior messages if resuming a conversation
    type DbMessage = { role: string; content: string };
    const priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (incomingConvId) {
      const rows = await db('support_messages')
        .where({ conversation_id: incomingConvId })
        .orderBy('created_at', 'asc')
        .select('role', 'content') as DbMessage[];
      for (const row of rows) {
        priorMessages.push({ role: row.role as 'user' | 'assistant', content: row.content });
      }
    }

    // Load knowledge base
    const knowledge = await loadKnowledgeBase();

    const userRole = req.user?.role ?? 'staff';
    const roleContext =
      userRole === 'admin'
        ? 'The user is an admin — they have full access including user management, tax codes, backup/restore, audit log, period unlocking, and MCP token management.'
        : userRole === 'reviewer'
        ? 'The user is a reviewer — they have read-only access and cannot edit the trial balance, post journal entries, or perform administrative actions.'
        : 'The user is a preparer — they have standard access to all client work including TB editing, journal entries, bank transactions, tax mapping, and reports.';

    const systemPrompt = `You are a helpful support assistant for Vibe Trial Balance, a tax preparation and accounting management suite for small accounting firms. Answer user questions clearly and concisely. Use the knowledge base below to answer questions about features, workflows, and troubleshooting. If you don't know the answer, say so honestly rather than guessing. Tailor your answers to the user's role.

User role: ${userRole}. ${roleContext}

${knowledge}`;

    // Build messages array
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...priorMessages,
      { role: 'user', content: message.trim() },
    ];

    const { provider, primaryModel } = await getLLMProvider();

    // Stream the response
    let fullText = '';
    const gen = provider.stream({
      model: primaryModel,
      maxTokens: 2048,
      system: systemPrompt,
      messages,
    });

    let chunk = await gen.next();
    while (!chunk.done) {
      fullText += chunk.value;
      writeEvent({ type: 'delta', text: chunk.value });
      chunk = await gen.next();
    }
    const usage = chunk.value;
    logAiUsage({ endpoint: 'support/chat', model: primaryModel, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, userId: req.user?.userId, clientId: null });

    // Save messages to DB
    await db('support_messages').insert([
      { conversation_id: conversationId, role: 'user', content: message.trim() },
      { conversation_id: conversationId, role: 'assistant', content: fullText },
    ]);

    writeEvent({ type: 'done', fullText, conversationId });
    res.end();
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : 'Unknown error';
    writeEvent({ type: 'error', message: errMessage });
    res.end();
  }
});

// GET /api/v1/support/conversations
supportRouter.get('/conversations', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const rows = await db('support_conversations as sc')
      .where('sc.user_id', userId)
      .leftJoin('support_messages as sm', 'sm.conversation_id', 'sc.id')
      .select('sc.id', 'sc.title', 'sc.is_bookmarked', 'sc.created_at', 'sc.updated_at')
      .count('sm.id as message_count')
      .groupBy('sc.id', 'sc.title', 'sc.is_bookmarked', 'sc.created_at', 'sc.updated_at')
      .orderBy('sc.updated_at', 'desc');
    res.json({ data: rows, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// GET /api/v1/support/conversations/:id
supportRouter.get('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const id = Number(req.params.id);
  if (!userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const conv = await db('support_conversations').where({ id, user_id: userId }).first();
    if (!conv) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }
    const messages = await db('support_messages')
      .where({ conversation_id: id })
      .orderBy('created_at', 'asc')
      .select('id', 'role', 'content', 'created_at');
    res.json({ data: { ...conv, messages }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// PUT /api/v1/support/conversations/:id
supportRouter.put('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const id = Number(req.params.id);
  if (!userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const { title, is_bookmarked } = req.body as { title?: string; is_bookmarked?: boolean };
    const updates: Record<string, unknown> = { updated_at: db.fn.now() };
    if (title !== undefined) updates.title = title;
    if (is_bookmarked !== undefined) updates.is_bookmarked = is_bookmarked;
    const count = await db('support_conversations').where({ id, user_id: userId }).update(updates);
    if (!count) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }
    const conv = await db('support_conversations').where({ id }).first();
    res.json({ data: conv, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// DELETE /api/v1/support/conversations/:id
supportRouter.delete('/conversations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const id = Number(req.params.id);
  if (!userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const count = await db('support_conversations').where({ id, user_id: userId }).delete();
    if (!count) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }
    res.json({ data: { deleted: true }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});

// POST /api/v1/support/conversations/:id/bookmark
supportRouter.post('/conversations/:id/bookmark', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const id = Number(req.params.id);
  if (!userId) {
    res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    return;
  }
  try {
    const conv = await db('support_conversations').where({ id, user_id: userId }).first();
    if (!conv) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
      return;
    }
    const newValue = !conv.is_bookmarked;
    await db('support_conversations').where({ id }).update({ is_bookmarked: newValue, updated_at: db.fn.now() });
    res.json({ data: { is_bookmarked: newValue }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
  }
});
