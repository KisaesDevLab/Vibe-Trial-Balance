import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import knex from 'knex';
import config from '../knexfile';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import { coaCollectionRouter, coaItemRouter } from './routes/chartOfAccounts';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

export const db = knex(config['development']);

app.get('/api/v1/health', async (_req, res) => {
  try {
    const result = await db.raw('SELECT NOW() AS now');
    res.json({
      data: { status: 'ok', database: 'connected', timestamp: result.rows[0].now },
      error: null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ data: null, error: { code: 'DB_ERROR', message } });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/clients', clientRoutes);
app.use('/api/v1/clients/:clientId/chart-of-accounts', coaCollectionRouter);
app.use('/api/v1/chart-of-accounts', coaItemRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
});

export { app };
