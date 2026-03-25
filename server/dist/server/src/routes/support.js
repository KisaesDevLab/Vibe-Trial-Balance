"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportRouter = void 0;
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.supportRouter = (0, express_1.Router)();
exports.supportRouter.use(auth_1.authMiddleware);
async function getAnthropicClient() {
    const setting = await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).first('value');
    const apiKey = setting?.value ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
        throw new Error('Claude API key not configured');
    return new sdk_1.default({ apiKey });
}
async function loadKnowledgeBase() {
    const knowledgeDir = path_1.default.resolve(__dirname, '../../knowledge');
    let combined = '';
    try {
        const files = fs_1.default.readdirSync(knowledgeDir).filter((f) => f.endsWith('.md'));
        for (const file of files) {
            const filePath = path_1.default.join(knowledgeDir, file);
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            const title = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            combined += `\n\n## Knowledge: ${title}\n\n${content}`;
        }
    }
    catch {
        combined = '(Knowledge base unavailable)';
    }
    return combined;
}
// POST /api/v1/support/chat — SSE streaming
exports.supportRouter.post('/chat', async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
    }
    const { conversationId: incomingConvId, message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'message is required' } });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const writeEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    try {
        // Determine or create conversation
        let conversationId = incomingConvId ?? 0;
        if (!conversationId) {
            const [newConv] = await (0, db_1.db)('support_conversations')
                .insert({
                user_id: userId,
                title: message.trim().slice(0, 60),
                is_bookmarked: false,
            })
                .returning('id');
            conversationId = typeof newConv === 'object' ? newConv.id : newConv;
        }
        // Emit start event with conversationId
        writeEvent({ type: 'start', conversationId });
        const priorMessages = [];
        if (incomingConvId) {
            const rows = await (0, db_1.db)('support_messages')
                .where({ conversation_id: incomingConvId })
                .orderBy('created_at', 'asc')
                .select('role', 'content');
            for (const row of rows) {
                priorMessages.push({ role: row.role, content: row.content });
            }
        }
        // Load knowledge base
        const knowledge = await loadKnowledgeBase();
        const userRole = req.user?.role ?? 'staff';
        const roleContext = userRole === 'admin'
            ? 'The user is an admin — they have full access including user management, tax codes, backup/restore, audit log, period unlocking, and MCP token management.'
            : userRole === 'reviewer'
                ? 'The user is a reviewer — they have read-only access and cannot edit the trial balance, post journal entries, or perform administrative actions.'
                : 'The user is a preparer — they have standard access to all client work including TB editing, journal entries, bank transactions, tax mapping, and reports.';
        const systemPrompt = `You are a helpful support assistant for the Trial Balance App, a tax preparation and accounting management suite for small accounting firms. Answer user questions clearly and concisely. Use the knowledge base below to answer questions about features, workflows, and troubleshooting. If you don't know the answer, say so honestly rather than guessing. Tailor your answers to the user's role.

User role: ${userRole}. ${roleContext}

${knowledge}`;
        // Build messages array
        const messages = [
            ...priorMessages,
            { role: 'user', content: message.trim() },
        ];
        const anthropic = await getAnthropicClient();
        // Stream the response
        let fullText = '';
        const stream = await anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: systemPrompt,
            messages,
        });
        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' &&
                chunk.delta.type === 'text_delta') {
                const text = chunk.delta.text;
                fullText += text;
                writeEvent({ type: 'delta', text });
            }
        }
        // Save messages to DB
        await (0, db_1.db)('support_messages').insert([
            { conversation_id: conversationId, role: 'user', content: message.trim() },
            { conversation_id: conversationId, role: 'assistant', content: fullText },
        ]);
        writeEvent({ type: 'done', fullText, conversationId });
        res.end();
    }
    catch (err) {
        const errMessage = err instanceof Error ? err.message : 'Unknown error';
        writeEvent({ type: 'error', message: errMessage });
        res.end();
    }
});
// GET /api/v1/support/conversations
exports.supportRouter.get('/conversations', async (req, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('support_conversations as sc')
            .where('sc.user_id', userId)
            .leftJoin('support_messages as sm', 'sm.conversation_id', 'sc.id')
            .select('sc.id', 'sc.title', 'sc.is_bookmarked', 'sc.created_at', 'sc.updated_at')
            .count('sm.id as message_count')
            .groupBy('sc.id', 'sc.title', 'sc.is_bookmarked', 'sc.created_at', 'sc.updated_at')
            .orderBy('sc.updated_at', 'desc');
        res.json({ data: rows, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/support/conversations/:id
exports.supportRouter.get('/conversations/:id', async (req, res) => {
    const userId = req.user?.userId;
    const id = Number(req.params.id);
    if (!userId) {
        res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
    }
    try {
        const conv = await (0, db_1.db)('support_conversations').where({ id, user_id: userId }).first();
        if (!conv) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
            return;
        }
        const messages = await (0, db_1.db)('support_messages')
            .where({ conversation_id: id })
            .orderBy('created_at', 'asc')
            .select('id', 'role', 'content', 'created_at');
        res.json({ data: { ...conv, messages }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PUT /api/v1/support/conversations/:id
exports.supportRouter.put('/conversations/:id', async (req, res) => {
    const userId = req.user?.userId;
    const id = Number(req.params.id);
    if (!userId) {
        res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
    }
    try {
        const { title, is_bookmarked } = req.body;
        const updates = { updated_at: db_1.db.fn.now() };
        if (title !== undefined)
            updates.title = title;
        if (is_bookmarked !== undefined)
            updates.is_bookmarked = is_bookmarked;
        const count = await (0, db_1.db)('support_conversations').where({ id, user_id: userId }).update(updates);
        if (!count) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
            return;
        }
        const conv = await (0, db_1.db)('support_conversations').where({ id }).first();
        res.json({ data: conv, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/support/conversations/:id
exports.supportRouter.delete('/conversations/:id', async (req, res) => {
    const userId = req.user?.userId;
    const id = Number(req.params.id);
    if (!userId) {
        res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
    }
    try {
        const count = await (0, db_1.db)('support_conversations').where({ id, user_id: userId }).delete();
        if (!count) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
            return;
        }
        res.json({ data: { deleted: true }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/support/conversations/:id/bookmark
exports.supportRouter.post('/conversations/:id/bookmark', async (req, res) => {
    const userId = req.user?.userId;
    const id = Number(req.params.id);
    if (!userId) {
        res.status(401).json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
        return;
    }
    try {
        const conv = await (0, db_1.db)('support_conversations').where({ id, user_id: userId }).first();
        if (!conv) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Conversation not found' } });
            return;
        }
        const newValue = !conv.is_bookmarked;
        await (0, db_1.db)('support_conversations').where({ id }).update({ is_bookmarked: newValue, updated_at: db_1.db.fn.now() });
        res.json({ data: { is_bookmarked: newValue }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=support.js.map