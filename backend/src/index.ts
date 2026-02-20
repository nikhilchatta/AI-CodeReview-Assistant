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
app.use(express.json({ limit: '5mb' }));

// Code review API routes
app.use('/api', createAIAnalyzeRouter());
app.use('/api', createAIPlatformRouter());
app.use('/api', createBatchReviewRouter());

// PR gate review route (GitHub Actions workflow entry point)
app.use('/api', createPRReviewRouter());

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
