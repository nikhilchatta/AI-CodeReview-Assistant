import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createAIAnalyzeRouter } from './routes/ai-analyze.js';
import { createAIPlatformRouter } from './routes/ai-platform.js';
import { createBatchReviewRouter } from './routes/batch-review.js';
import { createMetricsRouter } from './routes/metrics.js';
import { createPRReviewRouter } from './routes/pr-review.js';
import { createRunDetailsRouter } from './routes/run-details.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());

// ── JSON body parser ────────────────────────────────────────────────────────
// Reads the body stream directly rather than relying on Content-Length /
// Transfer-Encoding headers being present (nginx keepalive proxying can strip
// Content-Length, causing body-parser's hasBody() check to return false and
// silently skip parsing, leaving req.body as {}).
const JSON_BODY_LIMIT = 5 * 1024 * 1024; // 5 MB

app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.includes('application/json')) {
    next();
    return;
  }

  console.log(
    `[BODY-PARSER] ${req.method} ${req.url} | ` +
    `Content-Length: ${req.headers['content-length'] ?? 'none'} | ` +
    `Transfer-Encoding: ${req.headers['transfer-encoding'] ?? 'none'}`,
  );

  let data = '';
  let byteLen = 0;
  req.setEncoding('utf-8');

  req.on('data', (chunk: string) => {
    byteLen += Buffer.byteLength(chunk, 'utf-8');
    if (byteLen > JSON_BODY_LIMIT) {
      res.status(413).json({ error: 'Request body too large (max 5 MB)' });
      req.destroy();
      return;
    }
    data += chunk;
  });

  req.on('end', () => {
    console.log(`[BODY-PARSER] Read ${data.length} chars from body`);
    if (data.length > 0) {
      try {
        req.body = JSON.parse(data);
      } catch {
        res.status(400).json({ error: 'Invalid JSON in request body' });
        return;
      }
    } else {
      req.body = {};
    }
    next();
  });

  req.on('error', (err: Error) => {
    console.error('[BODY-PARSER] Stream error:', err.message);
    next(err);
  });
});

// PR gate review route — must be registered BEFORE batch-review to avoid route shadowing
app.use('/api', createPRReviewRouter());

// Code review API routes
app.use('/api', createAIAnalyzeRouter());
app.use('/api', createAIPlatformRouter());
app.use('/api', createBatchReviewRouter());

// Observability metrics routes
app.use('/api', createMetricsRouter());

// Run details drill-down routes
app.use('/api', createRunDetailsRouter());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-code-review-assistant',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[server] AI Code Review Assistant running on http://localhost:${PORT}`);
});
