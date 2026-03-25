"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.use(auth_1.authMiddleware);
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ data: null, error: { code: 'FORBIDDEN', message: 'Admin access required.' } });
        return;
    }
    next();
}
const userSchema = zod_1.z.object({
    username: zod_1.z.string().min(2).max(100),
    displayName: zod_1.z.string().min(1).max(255),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['admin', 'reviewer', 'preparer']),
});
// GET /api/v1/users
exports.usersRouter.get('/', adminOnly, async (_req, res) => {
    try {
        const users = await (0, db_1.db)('app_users')
            .select('id', 'username', 'display_name', 'role', 'is_active', 'created_at', 'updated_at')
            .orderBy('display_name');
        res.json({ data: users, error: null, meta: { count: users.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// POST /api/v1/users
exports.usersRouter.post('/', adminOnly, async (req, res) => {
    const parsed = userSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
        return;
    }
    const { username, displayName, password, role } = parsed.data;
    try {
        const hash = await bcrypt_1.default.hash(password, 12);
        const [user] = await (0, db_1.db)('app_users').insert({
            username,
            display_name: displayName,
            password_hash: hash,
            role,
            is_active: true,
        }).returning(['id', 'username', 'display_name', 'role', 'is_active', 'created_at']);
        res.status(201).json({ data: user, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.includes('unique') || message.includes('duplicate')) {
            res.status(409).json({ data: null, error: { code: 'DUPLICATE', message: 'Username already exists.' } });
            return;
        }
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// PATCH /api/v1/users/:id
exports.usersRouter.patch('/:id', adminOnly, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid user ID' } });
        return;
    }
    const patchSchema = zod_1.z.object({
        displayName: zod_1.z.string().min(1).max(255).optional(),
        password: zod_1.z.string().min(6).optional(),
        role: zod_1.z.enum(['admin', 'reviewer', 'preparer']).optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } });
        return;
    }
    const updates = { updated_at: db_1.db.fn.now() };
    if (parsed.data.displayName !== undefined)
        updates.display_name = parsed.data.displayName;
    if (parsed.data.role !== undefined)
        updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined)
        updates.is_active = parsed.data.isActive;
    if (parsed.data.password)
        updates.password_hash = await bcrypt_1.default.hash(parsed.data.password, 12);
    try {
        const [updated] = await (0, db_1.db)('app_users').where({ id }).update(updates)
            .returning(['id', 'username', 'display_name', 'role', 'is_active', 'updated_at']);
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
// DELETE /api/v1/users/:id  (deactivate — never hard delete)
exports.usersRouter.delete('/:id', adminOnly, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid user ID' } });
        return;
    }
    if (id === req.user.userId) {
        res.status(400).json({ data: null, error: { code: 'INVALID_INPUT', message: 'You cannot deactivate your own account.' } });
        return;
    }
    try {
        const [updated] = await (0, db_1.db)('app_users').where({ id })
            .update({ is_active: false, updated_at: db_1.db.fn.now() })
            .returning(['id', 'username', 'is_active']);
        if (!updated) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
            return;
        }
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
//# sourceMappingURL=users.js.map