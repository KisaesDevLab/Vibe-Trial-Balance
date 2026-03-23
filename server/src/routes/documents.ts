/**
 * Phase 16: Document Storage
 * GET    /api/v1/clients/:clientId/documents       -> list documents
 * POST   /api/v1/clients/:clientId/documents       -> upload file (multipart)
 * GET    /api/v1/documents/:id/download            -> download file
 * DELETE /api/v1/documents/:id                     -> delete file + DB row
 * PUT    /api/v1/documents/:id/link                -> link to account or JE
 */
import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

export const documentsCollectionRouter = Router({ mergeParams: true });
export const documentsItemRouter = Router({ mergeParams: true });

documentsCollectionRouter.use(authMiddleware);
documentsItemRouter.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function getUploadsDir(clientId: number): string {
  // server/uploads/{clientId}/
  return path.resolve(__dirname, '../../uploads', String(clientId));
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── GET /api/v1/clients/:clientId/documents ─────────────────────────────────

documentsCollectionRouter.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid client ID' } });
    return;
  }
  try {
    const rows = await db('client_documents as d')
      .leftJoin('chart_of_accounts as coa', 'coa.id', 'd.linked_account_id')
      .leftJoin('journal_entries as je', 'je.id', 'd.linked_journal_entry_id')
      .leftJoin('app_users as u', 'u.id', 'd.uploaded_by')
      .where('d.client_id', clientId)
      .select(
        'd.id',
        'd.client_id',
        'd.filename',
        'd.file_size',
        'd.file_type',
        'd.linked_account_id',
        'd.linked_journal_entry_id',
        'd.uploaded_by',
        'd.uploaded_at',
        'coa.account_number',
        'coa.account_name',
        'je.entry_number as je_entry_number',
        'u.display_name as uploader_name',
      )
      .orderBy('d.uploaded_at', 'desc');
    res.json({ data: rows, error: null, meta: { total: rows.length } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'DB_ERROR', message } });
  }
});

// ─── POST /api/v1/clients/:clientId/documents ────────────────────────────────

documentsCollectionRouter.post(
  '/',
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
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
      const filePath = path.join(uploadsDir, storedFilename);

      fs.writeFileSync(filePath, req.file.buffer);

      const [doc] = await db('client_documents')
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ data: null, error: { code: 'UPLOAD_ERROR', message } });
    }
  },
);

// ─── GET /api/v1/documents/:id/download ─────────────────────────────────────

documentsItemRouter.get('/:id/download', async (req: AuthRequest, res: Response): Promise<void> => {
  const docId = Number(req.params.id);
  if (isNaN(docId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid document ID' } });
    return;
  }
  try {
    const doc = await db('client_documents').where({ id: docId }).first();
    if (!doc) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    if (!fs.existsSync(doc.file_path as string)) {
      res.status(404).json({ data: null, error: { code: 'FILE_MISSING', message: 'File not found on disk' } });
      return;
    }

    const fileBuffer = fs.readFileSync(doc.file_path as string);
    res.setHeader('Content-Type', doc.file_type as string);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.filename as string)}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    res.send(fileBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'DOWNLOAD_ERROR', message } });
  }
});

// ─── DELETE /api/v1/documents/:id ───────────────────────────────────────────

documentsItemRouter.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const docId = Number(req.params.id);
  if (isNaN(docId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid document ID' } });
    return;
  }
  try {
    const doc = await db('client_documents').where({ id: docId }).first();
    if (!doc) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    // Delete file from filesystem
    if (fs.existsSync(doc.file_path as string)) {
      fs.unlinkSync(doc.file_path as string);
    }

    await db('client_documents').where({ id: docId }).delete();
    res.json({ data: { id: docId }, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'DELETE_ERROR', message } });
  }
});

// ─── PUT /api/v1/documents/:id/link ─────────────────────────────────────────

documentsItemRouter.put('/:id/link', async (req: AuthRequest, res: Response): Promise<void> => {
  const docId = Number(req.params.id);
  if (isNaN(docId)) {
    res.status(400).json({ data: null, error: { code: 'INVALID_ID', message: 'Invalid document ID' } });
    return;
  }
  try {
    const doc = await db('client_documents').where({ id: docId }).first();
    if (!doc) {
      res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    const { linkedAccountId, linkedJournalEntryId } = req.body as {
      linkedAccountId?: number | null;
      linkedJournalEntryId?: number | null;
    };

    const updates: Record<string, unknown> = {};
    if (linkedAccountId !== undefined) updates.linked_account_id = linkedAccountId ?? null;
    if (linkedJournalEntryId !== undefined) updates.linked_journal_entry_id = linkedJournalEntryId ?? null;

    const [updated] = await db('client_documents')
      .where({ id: docId })
      .update(updates)
      .returning('*');

    res.json({ data: updated, error: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'LINK_ERROR', message } });
  }
});
