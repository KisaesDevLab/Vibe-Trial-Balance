"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.settingsRouter = (0, express_1.Router)();
exports.settingsRouter.use(auth_1.authMiddleware);
function maskKey(value) {
    if (value.length <= 8)
        return '••••••••';
    return '••••••••' + value.slice(-4);
}
// GET /api/v1/settings
exports.settingsRouter.get('/', async (_req, res) => {
    try {
        const rows = await (0, db_1.db)('settings').select('key', 'value', 'updated_at');
        const result = {
            claude_api_key: null,
        };
        for (const row of rows) {
            if (row.key === 'claude_api_key') {
                result.claude_api_key = {
                    masked: row.value ? maskKey(row.value) : null,
                    updated_at: row.updated_at,
                };
            }
        }
        res.json({ data: result, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PUT /api/v1/settings
exports.settingsRouter.put('/', async (req, res) => {
    const schema = zod_1.z.object({
        claudeApiKey: zod_1.z.string().min(1).max(200).optional(),
    });
    const result = schema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: result.error.message } });
        return;
    }
    try {
        if (result.data.claudeApiKey !== undefined) {
            await (0, db_1.db)('settings')
                .insert({ key: 'claude_api_key', value: result.data.claudeApiKey, updated_at: db_1.db.fn.now() })
                .onConflict('key')
                .merge({ value: result.data.claudeApiKey, updated_at: db_1.db.fn.now() });
        }
        res.json({ data: { saved: true }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/settings/claude-api-key
exports.settingsRouter.delete('/claude-api-key', async (_req, res) => {
    try {
        await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).delete();
        res.json({ data: { deleted: true }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// GET /api/v1/settings/mcp-token (admin only)
exports.settingsRouter.get('/mcp-token', async (req, res) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
        return;
    }
    try {
        const row = await (0, db_1.db)('settings').where({ key: 'mcp_token' }).first('value', 'updated_at');
        if (!row || !row.value) {
            res.json({ data: { configured: false, masked: null, updated_at: null }, error: null });
            return;
        }
        res.json({
            data: {
                configured: true,
                masked: maskKey(row.value),
                updated_at: row.updated_at,
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/settings/mcp-token/generate (admin only)
exports.settingsRouter.post('/mcp-token/generate', async (req, res) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
        return;
    }
    try {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        await (0, db_1.db)('settings')
            .insert({ key: 'mcp_token', value: token, updated_at: db_1.db.fn.now() })
            .onConflict('key')
            .merge({ value: token, updated_at: db_1.db.fn.now() });
        res.json({
            data: {
                token, // Full token returned ONCE on generation
                masked: maskKey(token),
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/settings/mcp-token (admin only)
exports.settingsRouter.delete('/mcp-token', async (req, res) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin only' } });
        return;
    }
    try {
        await (0, db_1.db)('settings').where({ key: 'mcp_token' }).delete();
        res.json({ data: { revoked: true }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/settings/test-claude-key
exports.settingsRouter.post('/test-claude-key', async (_req, res) => {
    try {
        const row = await (0, db_1.db)('settings').where({ key: 'claude_api_key' }).first('value');
        const apiKey = row?.value || process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            res.status(400).json({ data: null, error: { code: 'NO_KEY', message: 'No API key configured' } });
            return;
        }
        const { default: Anthropic } = await Promise.resolve().then(() => __importStar(require('@anthropic-ai/sdk')));
        const client = new Anthropic({ apiKey });
        await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
        });
        res.json({ data: { valid: true }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.json({ data: { valid: false, message }, error: null });
    }
});
//# sourceMappingURL=settings.js.map