"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpAuthMiddleware = mcpAuthMiddleware;
exports.getMcpAgentUserId = getMcpAgentUserId;
exports.generateMcpAgentJwt = generateMcpAgentJwt;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_1 = require("../db");
const JWT_SECRET = process.env.JWT_SECRET ?? 'local-dev-secret-12345';
/** Validates Bearer MCP token from Authorization header. Sets req.mcpUserId if valid. */
async function mcpAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const row = await (0, db_1.db)('settings').where({ key: 'mcp_token' }).first('value');
        if (!row || !row.value || row.value !== token) {
            res.status(401).json({ error: 'Invalid MCP token' });
            return;
        }
        // Look up mcp_agent user ID dynamically
        const agentUser = await (0, db_1.db)('app_users').where({ username: 'mcp_agent' }).first('id');
        if (agentUser) {
            req.mcpUserId = agentUser.id;
        }
        next();
    }
    catch {
        res.status(500).json({ error: 'Authentication error' });
    }
}
/** Get the mcp_agent user ID, creating it if needed */
async function getMcpAgentUserId() {
    const agentUser = await (0, db_1.db)('app_users').where({ username: 'mcp_agent' }).first('id');
    if (agentUser)
        return agentUser.id;
    // Fallback: return 0 if user doesn't exist yet
    return 0;
}
/** Generate a short-lived JWT for the mcp_agent user (used to call JWT-protected internal routes) */
async function generateMcpAgentJwt() {
    const agentUser = await (0, db_1.db)('app_users')
        .where({ username: 'mcp_agent' })
        .first('id', 'username', 'role');
    if (!agentUser)
        return null;
    return jsonwebtoken_1.default.sign({ userId: agentUser.id, username: agentUser.username, role: agentUser.role }, JWT_SECRET, { expiresIn: '5m' });
}
//# sourceMappingURL=auth.js.map