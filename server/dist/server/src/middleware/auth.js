"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-12345';
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res
            .status(401)
            .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    }
    catch {
        res
            .status(401)
            .json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
    }
}
//# sourceMappingURL=auth.js.map