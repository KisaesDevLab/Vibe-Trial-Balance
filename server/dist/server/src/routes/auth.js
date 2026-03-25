"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-12345';
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '8h';
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1),
    password: zod_1.z.string().min(1),
});
router.post('/login', async (req, res) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        res.status(400).json({
            data: null,
            error: { code: 'VALIDATION_ERROR', message: 'Username and password required' },
        });
        return;
    }
    const { username, password } = result.data;
    try {
        const user = await (0, db_1.db)('app_users').where({ username, is_active: true }).first();
        if (!user || !(await bcrypt_1.default.compare(password, user.password_hash))) {
            res.status(401).json({
                data: null,
                error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' },
            });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.json({
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    displayName: user.display_name,
                    role: user.role,
                },
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    try {
        const user = await (0, db_1.db)('app_users')
            .where({ id: req.user.userId, is_active: true })
            .select('id', 'username', 'display_name', 'role')
            .first();
        if (!user) {
            res
                .status(404)
                .json({ data: null, error: { code: 'NOT_FOUND', message: 'User not found' } });
            return;
        }
        res.json({
            data: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                role: user.role,
            },
            error: null,
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'SERVER_ERROR', message } });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map