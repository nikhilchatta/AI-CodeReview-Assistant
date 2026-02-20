/**
 * Run Details API Routes
 *
 * POST /api/metrics/runs        – Store full drill-down detail for a workflow run
 * GET  /api/metrics/runs        – Query run details with filters (list view)
 * GET  /api/metrics/runs/:runId – Fetch single run detail (drill-down view)
 *
 * These endpoints power the Observability dashboard drill-down:
 * clicking on a failure count or issue number fetches the full
 * structured record including all validation failures and LLM findings.
 */

import { Router, type Request, type Response } from 'express';
import {
  insertRunDetail,
  getRunDetail,
  queryRunDetails,
  ensureRunDetailsSchema,
  type RunDetail,
} from '../db/run-details.js';

// Ensure the run_details table exists at module load time
ensureRunDetailsSchema().catch(err =>
  console.error('[RUN-DETAILS] Schema init failed:', err.message),
);

export function createRunDetailsRouter(): Router {
  const router = Router();

  // ── POST /api/metrics/runs ─────────────────────────────────────────────
  // Called by the GitHub Actions workflow after receiving the PR review response.
  // Stores the full drill-down payload so the dashboard can display it.
  router.post('/metrics/runs', async (req: Request, res: Response) => {
    try {
      const body = req.body as Partial<RunDetail>;

      // Required field validation
      const missing: string[] = [];
      if (!body.run_id)           missing.push('run_id');
      if (!body.repository)       missing.push('repository');
      if (!body.workflow_run_id)  missing.push('workflow_run_id');

      if (missing.length > 0) {
        return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      }

      const validStatuses = ['success', 'failure', 'partial'];
      const validGates    = ['pass', 'fail'];

      if (body.status && !validStatuses.includes(body.status)) {
        return res.status(400).json({ error: `Invalid status: ${body.status}` });
      }
      if (body.gate_status && !validGates.includes(body.gate_status)) {
        return res.status(400).json({ error: `Invalid gate_status: ${body.gate_status}` });
      }

      const detail = await insertRunDetail({
        run_id:               body.run_id!,
        metric_id:            body.metric_id,
        repository:           body.repository!,
        pr_number:            body.pr_number,
        commit_sha:           body.commit_sha,
        actor:                body.actor,
        branch:               body.branch,
        base_branch:          body.base_branch,
        workflow_run_id:      body.workflow_run_id!,
        project_id:           body.project_id,
        gate_status:          body.gate_status ?? 'pass',
        status:               body.status ?? 'success',
        validation_failures:  body.validation_failures ?? [],
        llm_findings:         body.llm_findings ?? [],
        per_file_results:     body.per_file_results ?? [],
        severity_distribution: body.severity_distribution ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        total_issues:         body.total_issues ?? 0,
        critical_count:       body.critical_count ?? 0,
        high_count:           body.high_count ?? 0,
        medium_count:         body.medium_count ?? 0,
        low_count:            body.low_count ?? 0,
        files_reviewed:       body.files_reviewed ?? 0,
        input_tokens:         body.input_tokens ?? 0,
        output_tokens:        body.output_tokens ?? 0,
        total_tokens:         body.total_tokens ?? 0,
        cost_usd:             body.cost_usd ?? 0,
        model:                body.model,
        latency_ms:           body.latency_ms ?? 0,
        timestamp:            body.timestamp || new Date().toISOString(),
        runtime_ms:           body.runtime_ms ?? body.latency_ms ?? 0,
      });

      console.log(`[RUN-DETAILS] Stored run ${detail.run_id} for ${detail.repository}`);
      res.status(201).json({ id: detail.id, run_id: detail.run_id, status: 'recorded' });
    } catch (error: any) {
      console.error('[RUN-DETAILS] Store failed:', error.message);
      res.status(500).json({ error: 'Failed to store run detail', details: error.message });
    }
  });

  // ── GET /api/metrics/runs ──────────────────────────────────────────────
  // List run details with optional filters. Used for the dashboard table.
  // Returns lightweight records (no full JSON blobs) for listing efficiency.
  router.get('/metrics/runs', async (req: Request, res: Response) => {
    try {
      const filters = {
        repository:  req.query.repository  as string | undefined,
        project_id:  req.query.project_id  as string | undefined,
        status:      req.query.status      as string | undefined,
        gate_status: req.query.gate_status as string | undefined,
        from:        req.query.from        as string | undefined,
        to:          req.query.to          as string | undefined,
        limit:  req.query.limit  ? parseInt(req.query.limit  as string, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const runs = await queryRunDetails(filters);

      // For the list view, strip the large JSON blob arrays to keep response small.
      // The full payload is available via GET /api/metrics/runs/:runId.
      const summary = runs.map(r => ({
        id:                   r.id,
        run_id:               r.run_id,
        repository:           r.repository,
        project_id:           r.project_id,
        pr_number:            r.pr_number,
        commit_sha:           r.commit_sha,
        actor:                r.actor,
        branch:               r.branch,
        workflow_run_id:      r.workflow_run_id,
        gate_status:          r.gate_status,
        status:               r.status,
        severity_distribution: r.severity_distribution,
        total_issues:         r.total_issues,
        critical_count:       r.critical_count,
        high_count:           r.high_count,
        medium_count:         r.medium_count,
        low_count:            r.low_count,
        files_reviewed:       r.files_reviewed,
        input_tokens:         r.input_tokens,
        output_tokens:        r.output_tokens,
        total_tokens:         r.total_tokens,
        cost_usd:             r.cost_usd,
        model:                r.model,
        latency_ms:           r.latency_ms,
        timestamp:            r.timestamp,
        runtime_ms:           r.runtime_ms,
        validation_failure_count: r.validation_failures.length,
        llm_finding_count:        r.llm_findings.length,
      }));

      res.json({ data: summary, count: summary.length });
    } catch (error: any) {
      console.error('[RUN-DETAILS] List query failed:', error.message);
      res.status(500).json({ error: 'Failed to query run details', details: error.message });
    }
  });

  // ── GET /api/metrics/runs/:runId ───────────────────────────────────────
  // Fetch complete drill-down record for a single run.
  // Returns full validation_failures, llm_findings, and per_file_results arrays.
  router.get('/metrics/runs/:runId', async (req: Request, res: Response) => {
    try {
      const { runId } = req.params;

      if (!runId) {
        return res.status(400).json({ error: 'runId is required' });
      }

      const detail = await getRunDetail(runId);

      if (!detail) {
        return res.status(404).json({ error: `Run detail not found: ${runId}` });
      }

      res.json(detail);
    } catch (error: any) {
      console.error('[RUN-DETAILS] Fetch failed:', error.message);
      res.status(500).json({ error: 'Failed to fetch run detail', details: error.message });
    }
  });

  return router;
}
