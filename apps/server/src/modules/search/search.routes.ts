import { Router } from 'express';
import { webSearch } from './search.service.js';

export const searchRouter = Router();

// GET /api/v1/search?q=...&limit=5 — debug endpoint
searchRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const limit = Math.min(Number(req.query.limit ?? 5) || 5, 10);
  if (!q) {
    res.status(400).json({ error: 'q required' });
    return;
  }
  const results = await webSearch(q, limit);
  res.json({ query: q, count: results.length, results });
});
