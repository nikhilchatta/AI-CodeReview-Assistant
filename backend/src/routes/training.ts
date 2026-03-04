/**
 * Training Data Routes
 *
 * POST /api/training/feedback
 *   Accept human feedback for a review run from any channel:
 *   dashboard buttons, GitHub comment reactions, or PR review thread events.
 *   Appends a training_feedback row and recomputes outcome labels.
 *
 * GET /api/training/export
 *   Export the training dataset as self-contained JSONL or JSON records.
 *   Each record embeds diff, prompt, findings, feedback, and labels.
 *
 * POST /api/webhook/github
 *   Receive GitHub webhook events (issue_comment reactions, pull_request_review)
 *   and map them to training feedback rows.
 */

import { Router, type Request, type Response } from 'express';
import {
  getTrainingRecordIdByRunId,
  insertTrainingFeedback,
  computeAndStoreLabels,
  exportTrainingRecords,
  ensureTrainingSchema,
  getTrainingStats,
  listTrainingRecords,
  type TrainingExportFilters,
} from '../db/training.js';

// Ensure schema exists at module load
ensureTrainingSchema().catch((err) =>
  console.error('[TRAINING] Schema init failed:', err.message),
);

export function createTrainingRouter(): Router {
  const router = Router();

  // ── POST /api/training/feedback ────────────────────────────────────────────
  //
  // Body:
  //   run_id          string   required  — the review run to attach feedback to
  //   action          string   required  — 'accept' | 'reject' | 'modify'
  //   finding_index   number   optional  — which finding (null = gate-level)
  //   finding_type    string   optional  — 'validation' | 'llm' | 'gate'
  //   reason          string   optional  — free-text explanation
  //   corrected_findings  []   optional  — corrected list if action='modify'
  //   reviewer_id     string   optional  — GitHub username or user identifier
  //   feedback_channel string  optional  — 'dashboard' | 'gh' | 'pr' (default: 'dashboard')
  router.post('/training/feedback', async (req: Request, res: Response) => {
    try {
      const {
        run_id,
        action,
        finding_index,
        finding_type,
        reason,
        corrected_findings,
        reviewer_id,
        feedback_channel = 'dashboard',
      } = req.body as {
        run_id: string;
        action: 'accept' | 'reject' | 'modify';
        finding_index?: number;
        finding_type?: 'validation' | 'llm' | 'gate';
        reason?: string;
        corrected_findings?: object[];
        reviewer_id?: string;
        feedback_channel?: 'dashboard' | 'gh' | 'pr';
      };

      // Validate required fields
      if (!run_id) {
        return res.status(400).json({ error: 'run_id is required' });
      }
      if (!action || !['accept', 'reject', 'modify'].includes(action)) {
        return res.status(400).json({ error: "action must be 'accept', 'reject', or 'modify'" });
      }

      // Resolve training record id
      const recordId = await getTrainingRecordIdByRunId(run_id);
      if (recordId === null) {
        return res.status(404).json({
          error: `No training record found for run_id: ${run_id}. ` +
                 'The review may have been run before the training system was enabled.',
        });
      }

      // Append the feedback row (never overwrites)
      const feedbackId = await insertTrainingFeedback({
        record_id:          recordId,
        run_id,
        finding_index:      finding_index ?? undefined,
        finding_type:       finding_type ?? undefined,
        action,
        reason:             reason ?? undefined,
        corrected_findings: JSON.stringify(corrected_findings ?? []),
        reviewer_id:        reviewer_id ?? undefined,
        feedback_channel,
        created_at:         new Date().toISOString(),
      });

      // Recompute labels from all accumulated feedback for this record
      await computeAndStoreLabels(recordId, run_id);

      console.log(
        `[TRAINING] Feedback ${feedbackId} recorded: run=${run_id} ` +
        `action=${action} channel=${feedback_channel}`,
      );

      return res.status(201).json({
        id:       feedbackId,
        run_id,
        action,
        status:   'recorded',
      });
    } catch (error: any) {
      console.error('[TRAINING] Feedback store failed:', error.message);
      return res.status(500).json({ error: 'Failed to store feedback', details: error.message });
    }
  });

  // ── GET /api/training/export ───────────────────────────────────────────────
  //
  // Query params:
  //   format          'jsonl' | 'json'   default: jsonl
  //   labeled         'true'             only records with feedback
  //   model_version   string             filter by model
  //   repository      string             filter by repo
  //   from            ISO date string    created_at >=
  //   to              ISO date string    created_at <=
  //   limit           number             default: 500
  //   offset          number             default: 0
  router.get('/training/export', async (req: Request, res: Response) => {
    try {
      const filters: TrainingExportFilters = {
        labeled:       req.query.labeled === 'true',
        model_version: req.query.model_version as string | undefined,
        repository:    req.query.repository    as string | undefined,
        from:          req.query.from          as string | undefined,
        to:            req.query.to            as string | undefined,
        limit:         req.query.limit  ? parseInt(req.query.limit  as string, 10) : 500,
        offset:        req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      };

      const records = await exportTrainingRecords(filters);
      const format  = (req.query.format as string) || 'jsonl';

      if (format === 'jsonl') {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="training-export-${Date.now()}.jsonl"`,
        );
        for (const record of records) {
          res.write(JSON.stringify(record) + '\n');
        }
        return res.end();
      }

      // Default: JSON array
      return res.json({ count: records.length, data: records });
    } catch (error: any) {
      console.error('[TRAINING] Export failed:', error.message);
      return res.status(500).json({ error: 'Export failed', details: error.message });
    }
  });

  // ── GET /api/training/stats ────────────────────────────────────────────────
  //
  // Returns aggregate counts and averages for the training dashboard.
  router.get('/training/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await getTrainingStats();
      return res.json(stats);
    } catch (error: any) {
      console.error('[TRAINING] Stats failed:', error.message);
      return res.status(500).json({ error: 'Failed to fetch training stats', details: error.message });
    }
  });

  // ── GET /api/training/records ──────────────────────────────────────────────
  //
  // Paginated list of training records with label info (no diff/prompt fields).
  //
  // Query params:
  //   repository  string    filter by repo
  //   labeled     'true'    only records with a supervised_label
  //   from        ISO date  created_at >=
  //   to          ISO date  created_at <=
  //   limit       number    default: 50
  //   offset      number    default: 0
  router.get('/training/records', async (req: Request, res: Response) => {
    try {
      const records = await listTrainingRecords({
        repository: req.query.repository as string | undefined,
        labeled:    req.query.labeled === 'true',
        from:       req.query.from    as string | undefined,
        to:         req.query.to      as string | undefined,
        limit:      req.query.limit  ? parseInt(req.query.limit  as string, 10) : 50,
        offset:     req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
      });
      return res.json({ count: records.length, data: records });
    } catch (error: any) {
      console.error('[TRAINING] Records list failed:', error.message);
      return res.status(500).json({ error: 'Failed to list training records', details: error.message });
    }
  });

  return router;
}

// ── GitHub Webhook Router ──────────────────────────────────────────────────────
//
// Receives GitHub webhook events and maps them to training feedback.
//
// Supported events:
//   issue_comment  — reactions on the AI bot comment (👍 = accept, 👎 = reject)
//   pull_request_review — developer submits a review on the PR

export function createWebhookRouter(): Router {
  const router = Router();

  router.post('/webhook/github', async (req: Request, res: Response) => {
    try {
      const event = req.headers['x-github-event'] as string;
      const body  = req.body as Record<string, any>;

      // Verify this is from GitHub (optional secret check)
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
      if (webhookSecret) {
        const sig = req.headers['x-hub-signature-256'] as string;
        if (!sig) {
          return res.status(401).json({ error: 'Missing webhook signature' });
        }
        const { createHmac } = await import('crypto');
        const expected = 'sha256=' + createHmac('sha256', webhookSecret)
          .update(JSON.stringify(body))
          .digest('hex');
        if (sig !== expected) {
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      // ── issue_comment event — reactions on AI bot comment ──────────────────
      // GitHub sends this when someone reacts to a comment.
      // The bot comment body starts with "## " and contains "AI Code Review"
      if (event === 'issue_comment') {
        const action   = body.action;       // 'created'
        const comment  = body.comment;
        const sender   = body.sender?.login;

        if (action !== 'created' || !comment) {
          return res.status(200).json({ status: 'ignored', reason: 'not a new comment' });
        }

        // Only process reactions on the AI bot comment (identified by its header)
        const commentBody: string = comment.body || '';
        const isAIComment = commentBody.includes('AI Code Review');
        if (!isAIComment) {
          return res.status(200).json({ status: 'ignored', reason: 'not an AI review comment' });
        }

        // Extract run_id from the comment footer: `Run: \`<run_id>\``
        const runIdMatch = commentBody.match(/Run:\s*`([^`]+)`/);
        if (!runIdMatch) {
          return res.status(200).json({ status: 'ignored', reason: 'could not extract run_id from comment' });
        }

        const runId = runIdMatch[1];
        const recordId = await getTrainingRecordIdByRunId(runId);
        if (recordId === null) {
          return res.status(200).json({ status: 'ignored', reason: `no training record for run ${runId}` });
        }

        // Map the comment body pattern to a gate-level feedback action.
        // A 👍 reaction to a PASSED comment = agree; to a FAILED comment = disagree
        // Since reactions come as separate event payloads, map based on react content:
        const reaction = body.reaction?.content; // '+1' or '-1'
        let action_type: 'accept' | 'reject' | null = null;
        if (reaction === '+1') action_type = 'accept';
        if (reaction === '-1') action_type = 'reject';

        if (!action_type) {
          return res.status(200).json({ status: 'ignored', reason: 'unsupported reaction type' });
        }

        const feedbackId = await insertTrainingFeedback({
          record_id:         recordId,
          run_id:            runId,
          finding_index:     undefined,
          finding_type:      'gate',
          action:            action_type,
          reason:            `GitHub reaction: ${reaction}`,
          corrected_findings: '[]',
          reviewer_id:       sender,
          feedback_channel:  'gh',
          created_at:        new Date().toISOString(),
        });

        await computeAndStoreLabels(recordId, runId);

        console.log(`[WEBHOOK] GitHub reaction feedback: run=${runId} action=${action_type} by=${sender}`);
        return res.status(201).json({ id: feedbackId, status: 'recorded' });
      }

      // ── pull_request_review event ──────────────────────────────────────────
      // A developer approves or requests changes on the PR.
      if (event === 'pull_request_review') {
        const reviewState = body.review?.state; // 'approved' | 'changes_requested' | 'commented'
        const sender      = body.sender?.login;
        const prBody: string = body.review?.body || '';

        // Extract run_id if the review body mentions it
        const runIdMatch = prBody.match(/run(?:_id)?[:\s]+([a-zA-Z0-9\-_]+)/i);
        if (!runIdMatch) {
          return res.status(200).json({ status: 'ignored', reason: 'no run_id in review body' });
        }

        const runId = runIdMatch[1];
        const recordId = await getTrainingRecordIdByRunId(runId);
        if (recordId === null) {
          return res.status(200).json({ status: 'ignored', reason: `no training record for run ${runId}` });
        }

        let action_type: 'accept' | 'reject' | null = null;
        if (reviewState === 'approved')           action_type = 'accept';
        if (reviewState === 'changes_requested')  action_type = 'reject';

        if (!action_type) {
          return res.status(200).json({ status: 'ignored', reason: `review state ${reviewState} not mapped` });
        }

        const feedbackId = await insertTrainingFeedback({
          record_id:          recordId,
          run_id:             runId,
          finding_index:      undefined,
          finding_type:       'gate',
          action:             action_type,
          reason:             `PR review: ${reviewState}`,
          corrected_findings: '[]',
          reviewer_id:        sender,
          feedback_channel:   'pr',
          created_at:         new Date().toISOString(),
        });

        await computeAndStoreLabels(recordId, runId);

        console.log(`[WEBHOOK] PR review feedback: run=${runId} action=${action_type} by=${sender}`);
        return res.status(201).json({ id: feedbackId, status: 'recorded' });
      }

      // Unknown event — acknowledge and ignore
      return res.status(200).json({ status: 'ignored', event });
    } catch (error: any) {
      console.error('[WEBHOOK] GitHub webhook failed:', error.message);
      return res.status(500).json({ error: 'Webhook processing failed', details: error.message });
    }
  });

  return router;
}
