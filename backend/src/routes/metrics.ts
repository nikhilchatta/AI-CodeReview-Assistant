/**
 * Metrics API Routes
 *
 * POST /metrics/ingest   – Record a single workflow run's metrics
 * GET  /metrics          – Query metrics with filters
 * GET  /metrics/summary  – Aggregated dashboard stats
 * GET  /metrics/projects – List distinct project/repository pairs
 *
 * All endpoints are additive; they do not touch existing review logic.
 * Auth: accepts optional x-metrics-token header for future RBAC.
 */

import { Router, type Request, type Response } from 'express';
import {
  insertMetric,
  queryMetrics,
  getMetricsSummary,
  getProjects,
  type MetricRecord,
} from '../db/metrics.js';
import { calculateCost, getPricingTable } from '../db/pricing.js';

export function createMetricsRouter(): Router {
  const router = Router();

  // ── POST /metrics/ingest ──
  router.post('/metrics/ingest', async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<MetricRecord>;

      // Validate required fields
      const missing: string[] = [];
      if (!body.repository) missing.push('repository');
      if (!body.project_id) missing.push('project_id');
      if (!body.workflow_run_id) missing.push('workflow_run_id');
      if (body.status && !['success', 'failure', 'partial'].includes(body.status)) {
        return res.status(400).json({ error: `Invalid status: ${body.status}. Must be success|failure|partial.` });
      }

      if (missing.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      const inputTokens = body.input_tokens ?? 0;
      const outputTokens = body.output_tokens ?? 0;

      // Auto-calculate cost from model + tokens if not provided
      const costUsd = body.cost_usd ?? calculateCost(body.model, inputTokens, outputTokens);

      const metric = await insertMetric({
        repository: body.repository!,
        project_id: body.project_id!,
        workflow_run_id: body.workflow_run_id!,
        timestamp: body.timestamp || new Date().toISOString(),
        api_token_hash: body.api_token_hash,
        request_count: body.request_count ?? 0,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: body.total_tokens ?? inputTokens + outputTokens,
        latency_ms: body.latency_ms ?? 0,
        status: body.status ?? 'success',
        error_message: body.error_message,
        files_reviewed: body.files_reviewed ?? 0,
        issues_found: body.issues_found ?? 0,
        critical_count: body.critical_count ?? 0,
        high_count: body.high_count ?? 0,
        model: body.model,
        cost_usd: costUsd,
        pr_number: body.pr_number,
        branch: body.branch,
        triggered_by: body.triggered_by,
        source: body.source ?? 'pipeline',
      });

      console.log(`[METRICS] Ingested run ${metric.workflow_run_id} for ${metric.repository} (${metric.status}, $${costUsd.toFixed(6)})`);
      res.status(201).json({ id: metric.id, cost_usd: costUsd, status: 'recorded' });
    } catch (error: any) {
      console.error('[METRICS] Ingestion failed:', error.message);
      res.status(500).json({ error: 'Failed to record metric', details: error.message });
    }
  });

  // ── GET /metrics ──
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const filters = {
        repository: req.query.repository as string | undefined,
        project_id: req.query.project_id as string | undefined,
        status: req.query.status as string | undefined,
        source: req.query.source as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
      };

      const metrics = await queryMetrics(filters);
      res.json({ data: metrics, count: metrics.length });
    } catch (error: any) {
      console.error('[METRICS] Query failed:', error.message);
      res.status(500).json({ error: 'Failed to query metrics', details: error.message });
    }
  });

  // ── GET /metrics/summary ──
  router.get('/metrics/summary', async (req: Request, res: Response) => {
    try {
      const filters = {
        repository: req.query.repository as string | undefined,
        project_id: req.query.project_id as string | undefined,
        source: req.query.source as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      };

      const summary = await getMetricsSummary(filters);
      res.json(summary);
    } catch (error: any) {
      console.error('[METRICS] Summary failed:', error.message);
      res.status(500).json({ error: 'Failed to get summary', details: error.message });
    }
  });

  // ── GET /metrics/projects ──
  router.get('/metrics/projects', async (_req: Request, res: Response) => {
    try {
      const projects = await getProjects();
      res.json({ data: projects, count: projects.length });
    } catch (error: any) {
      console.error('[METRICS] Projects query failed:', error.message);
      res.status(500).json({ error: 'Failed to get projects', details: error.message });
    }
  });

  // ── GET /metrics/pricing ──
  router.get('/metrics/pricing', (_req: Request, res: Response) => {
    res.json(getPricingTable());
  });

  return router;
}
