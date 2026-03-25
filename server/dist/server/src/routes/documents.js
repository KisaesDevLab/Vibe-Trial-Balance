"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentsItemRouter = exports.documentsCollectionRouter = void 0;
/**
 * Phase 16: Document Storage
 * GET    /api/v1/clients/:clientId/documents       -> list documents
 * POST   /api/v1/clients/:clientId/documents       -> upload file (multipart)
 * GET    /api/v1/documents/:id/download            -> download file
 * DELETE /api/v1/documents/:id                     -> delete file + DB row
 * PUT    /api/v1/documents/:id/link                -> link to account or JE
 */
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../db");
const auth_1 = require("../middleware/auth");
exports.documentsCollectionRouter = (0, express_1.Router)({ mergeParams: true });
exports.documentsItemRouter = (0, express_1.Router)({ mergeParams: true });
exports.documentsCollectionRouter.use(auth_1.authMiddleware);
exports.documentsItemRouter.use(auth_1.authMiddleware);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});
// ─── helpers ─────────────────────────────────────────────────────────────────
function getUploadsDir(clientId) {
    // server/uploads/{clientId}/
    return path_1.default.resolve(__dirname, '../../uploads', String(clientId));
}
function ensureDir(dir) {
    fs_1.default.mkdirSync(dir, { recursive: true });
}
// ─── GET /api/v1/clients/:clientId/documents ─────────────────────────────────
exports.documentsCollectionRouter.get('/', async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    try {
        const rows = await (0, db_1.db)('client_documents as d')
            .leftJoin('chart_of_accounts as coa', 'coa.id', 'd.linked_account_id')
            .leftJoin('journal_entries as je', 'je.id', 'd.linked_journal_entry_id')
            .leftJoin('app_users as u', 'u.id', 'd.uploaded_by')
            .where('d.client_id', clientId)
            .select('d.id', 'd.client_id', 'd.filename', 'd.file_size', 'd.file_type', 'd.linked_account_id', 'd.linked_journal_entry_id', 'd.uploaded_by', 'd.uploaded_at', 'coa.account_number', 'coa.account_name', 'je.entry_number as je_entry_number', 'u.display_name as uploader_name')
            .orderBy('d.uploaded_at', 'desc');
        res.json({ data: rows, error: null, meta: { total: rows.length } });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'DB_ERROR', message } });
    }
});
// ─── POST /api/v1/clients/:clientId/documents ────────────────────────────────
exports.documentsCollectionRouter.post('/', upload.single('file'), async (req, res) => {
    const clientId = Number(req.params.clientId);
    if (isNaN(clientId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
        return;
    }
    if (!req.file) {
        res.status(400).json({ data: null, error: { code: 'NO_FILE', message: 'No file uploaded' } });
        return;
    }
    try {
        const uploadsDir = getUploadsDir(clientId);
        ensureDir(uploadsDir);
        const timestamp = Date.now();
        // Sanitize original name: replace spaces/special chars
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storedFilename = `${timestamp}_${safeName}`;
        const filePath = path_1.default.join(uploadsDir, storedFilename);
        fs_1.default.writeFileSync(filePath, req.file.buffer);
        const [doc] = await (0, db_1.db)('client_documents')
            .insert({
            client_id: clientId,
            filename: req.file.originalname,
            file_path: filePath,
            file_size: req.file.size,
            file_type: req.file.mimetype,
            uploaded_by: req.user?.userId ?? null,
        })
            .returning('*');
        res.status(201).json({ data: doc, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'UPLOAD_ERROR', message } });
    }
});
// ─── GET /api/v1/documents/:id/download ─────────────────────────────────────
exports.documentsItemRouter.get('/:id/download', async (req, res) => {
    const docId = Number(req.params.id);
    if (isNaN(docId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid document ID' } });
        return;
    }
    try {
        const doc = await (0, db_1.db)('client_documents').where({ id: docId }).first();
        if (!doc) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
            return;
        }
        if (!fs_1.default.existsSync(doc.file_path)) {
            res.status(404).json({ data: null, error: { code: 'FILE_MISSING', message: 'File not found on disk' } });
            return;
        }
        const fileBuffer = fs_1.default.readFileSync(doc.file_path);
        res.setHeader('Content-Type', doc.file_type);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename)}"`);
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'DOWNLOAD_ERROR', message } });
    }
});
// ─── DELETE /api/v1/documents/:id ───────────────────────────────────────────
exports.documentsItemRouter.delete('/:id', async (req, res) => {
    const docId = Number(req.params.id);
    if (isNaN(docId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid document ID' } });
        return;
    }
    try {
        const doc = await (0, db_1.db)('client_documents').where({ id: docId }).first();
        if (!doc) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
            return;
        }
        // Delete file from filesystem
        if (fs_1.default.existsSync(doc.file_path)) {
            fs_1.default.unlinkSync(doc.file_path);
        }
        await (0, db_1.db)('client_documents').where({ id: docId }).delete();
        res.json({ data: { id: docId }, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'DELETE_ERROR', message } });
    }
});
// ─── PUT /api/v1/documents/:id/link ─────────────────────────────────────────
exports.documentsItemRouter.put('/:id/link', async (req, res) => {
    const docId = Number(req.params.id);
    if (isNaN(docId)) {
        res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid document ID' } });
        return;
    }
    try {
        const doc = await (0, db_1.db)('client_documents').where({ id: docId }).first();
        if (!doc) {
            res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
            return;
        }
        const { linkedAccountId, linkedJournalEntryId } = req.body;
        const updates = {};
        if (linkedAccountId !== undefined)
            updates.linked_account_id = linkedAccountId ?? null;
        if (linkedJournalEntryId !== undefined)
            updates.linked_journal_entry_id = linkedJournalEntryId ?? null;
        const [updated] = await (0, db_1.db)('client_documents')
            .where({ id: docId })
            .update(updates)
            .returning('*');
        res.json({ data: updated, error: null });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).json({ data: null, error: { code: 'LINK_ERROR', message } });
    }
});
//# sourceMappingURL=documents.js.map