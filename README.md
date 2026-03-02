# AI Code Review Assistant

An AI-powered code review system that runs as a GitHub Actions gate on every pull request. It combines deterministic pattern rules with LLM analysis to catch bugs, security vulnerabilities, and quality issues before they merge — and builds a continuously growing training dataset from every review it performs.

---

## Table of Contents

- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Stack](#stack)
- [CI/CD Pipeline](#cicd-pipeline)
- [Backend API](#backend-api)
- [Observability Dashboard](#observability-dashboard)
- [Training Data System](#training-data-system)
- [Adopting This In Your Repo](#adopting-this-in-your-repo)

---

## How It Works

```
Developer opens a Pull Request
          │
          ▼
  GitHub Actions triggers
  ai-code-review.yml
          │
          ├── 1. Health check   → confirm EC2 backend is reachable
          │
          ├── 2. Checkout       → fetch full git history for diff
          │
          ├── 3. Diff           → compute changed files by extension
          │
          ├── 4. Build payload  → read file contents, assemble JSON with jq
          │
          ├── 5. AI Review      → POST /api/review/pr
          │       │
          │       ├── Pattern rules  → deterministic checks (SQL injection,
          │       │                    hardcoded secrets, missing error handling…)
          │       │
          │       └── LLM analysis  → Claude reviews logic, security, quality
          │
          ├── 6. PR Comment     → findings posted directly to the Pull Request
          │
          ├── 7. Metrics        → results stored for observability dashboard
          │
          └── 8. Gate           → workflow fails if gate_status = fail
                                  blocking the merge until issues are resolved
```

---

## Project Structure

```
AI-CodeReview-Assistant/
│
├── .github/
│   └── workflows/
│       ├── ai-code-review.yml      # Reusable workflow (this repo)
│       └── caller-template.yml     # Template for target repos to copy
│
├── backend/
│   └── src/
│       ├── index.ts                # Express app entry point
│       ├── config/                 # Environment config
│       ├── engine/
│       │   └── pattern-rules.ts   # Deterministic validation rules
│       ├── db/
│       │   ├── metrics.ts         # Metrics table schema + queries
│       │   ├── run-details.ts     # Run drill-down schema + queries
│       │   └── pricing.ts         # Token cost calculations
│       └── routes/
│           ├── pr-review.ts       # POST /api/review/pr  ← main endpoint
│           ├── ai-analyze.ts      # POST /api/analyze    (IDE / web)
│           ├── ai-platform.ts     # Platform review endpoint
│           ├── batch-review.ts    # Batch file review
│           ├── metrics.ts         # GET/POST /api/metrics/ingest
│           └── run-details.ts     # GET/POST /api/metrics/runs
│
├── frontend/
│   └── src/
│       └── pages/
│           └── ObservabilityPage.tsx   # Dashboard UI
│
├── vscode-extension/               # VS Code extension (.vsix)
├── docs/
│   ├── DYNAMIC_RULES.md
│   └── WORKFLOW_TRIGGERS.md
├── docker-compose.yml
├── nginx.conf
└── Dockerfile
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| LLM | Claude (Anthropic API) |
| Database | SQLite via Docker named volume `metrics_data` |
| Frontend | React + Vite, served by nginx |
| Deployment | Docker Compose on AWS EC2 (`3.94.200.65`) |
| CI/CD | GitHub Actions reusable workflow |
| IDE | VS Code Extension |

---

## CI/CD Pipeline

### How to adopt in any repository

Copy `caller-template.yml` into your repo's `.github/workflows/` folder and add two repository secrets:

| Secret | Value |
|--------|-------|
| `AI_AGENT_API_URL` | `http://3.94.200.65` |
| `AI_AGENT_API_KEY` | your API key |

The caller template triggers the reusable workflow in this repo on every pull request.

### What the workflow checks

**Pattern rules** run first — fast, deterministic, no LLM cost:

- Hardcoded secrets and API keys
- SQL injection patterns
- Missing input validation
- Dangerous function usage
- Security misconfigurations

**LLM analysis** runs second — catches what patterns cannot:

- Logic errors and off-by-one bugs
- Incorrect algorithm implementations
- Race conditions and async misuse
- Performance problems (N+1 queries, blocking I/O)
- Missing or incorrect error handling

### PR Comment Example

```
❌ AI Code Review — FAILED

Gate: FAIL | Issues: 3 | Files reviewed: 2

| Severity | Critical | High | Medium | Low | Info |
|----------|:--------:|:----:|:------:|:---:|:----:|
| Count    |    1     |  1   |   1    |  0  |  0   |

### Validation Failures (pattern rules)
- [CRITICAL] `security` — Possible SQL injection via string concat
  📍 `api/users.ts:42`
  > 💡 Use parameterised queries or an ORM

### AI Findings
- [HIGH] `logic` — Auth check runs after data fetch; user can read data
         before being rejected
  📍 `api/orders.ts:18`
  > 💡 Move the auth guard to the top of the handler
```

---

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/review/pr` | Run PR review (pattern + LLM) |
| `POST` | `/api/analyze` | Single-file review (IDE / web) |
| `POST` | `/api/metrics/ingest` | Store run summary metrics |
| `GET` | `/api/metrics/ingest` | Query metrics with filters |
| `POST` | `/api/metrics/runs` | Store full run drill-down |
| `GET` | `/api/metrics/runs` | List run records |
| `GET` | `/api/metrics/runs/:runId` | Single run detail |

### POST /api/review/pr — Request shape

```json
{
  "files": [
    {
      "path": "src/api/users.ts",
      "content": "...",
      "language": "typescript"
    }
  ],
  "analysis_type": "review",
  "metadata": {
    "repository": "org/repo",
    "pr_number": 42,
    "branch": "feature/auth",
    "base_branch": "main",
    "commit_sha": "abc123",
    "actor": "developer",
    "workflow_run_id": "9876543210"
  }
}
```

### POST /api/review/pr — Response shape

```json
{
  "run_id": "uuid",
  "gate_status": "fail",
  "status": "success",
  "total_issues": 3,
  "severity_breakdown": { "critical": 1, "high": 1, "medium": 1, "low": 0, "info": 0 },
  "validation_failures": [ { "file": "...", "line_number": 42, "severity": "critical", ... } ],
  "llm_findings":        [ { "file": "...", "line_number": 18, "severity": "high", ... } ],
  "per_file_results":    [ ... ],
  "files_reviewed": 2,
  "model": "claude-opus-4-6",
  "token_usage": { "input_tokens": 4200, "output_tokens": 380, "total_tokens": 4580 },
  "cost_usd": 0.001234,
  "latency_ms": 3210,
  "timestamp": "2025-06-01T14:32:00Z"
}
```

---

## Observability Dashboard

The React frontend (`http://3.94.200.65`) shows three data sources via the `source` field:

| Tab | Source tag | Populated by |
|-----|-----------|--------------|
| Pipeline | `pipeline` | GitHub Actions workflow |
| IDE | `ide` | VS Code extension |
| Application | `application` | Direct API calls |

**Pipeline tab shows per-run:**
- Gate result (pass / fail)
- Severity breakdown table
- Files reviewed, token usage, cost
- Drill-down into every finding per run

---

## Training Data System

Every review event is a learning signal. This section describes how to build a continuously growing, reproducible training dataset on top of this project.

### Why this matters

The system already captures most of what is needed. The gap between the current state and a proper training dataset is five things: **full diff storage, prompt capture, human feedback, outcome labels, and an append-only guarantee**.

---

### End-to-End Data Flow

```
PR opened
    │
    ▼
GitHub Actions runs review
    │
    ▼
Backend processes request
    ├── runs pattern rules
    ├── builds + sends prompt to LLM
    └── receives findings
    │
    ▼
┌─────────────────────────────────────────────────┐
│            WRITE TRAINING RECORD                │
│                  (append-only)                  │
│                                                 │
│  run_id            commit_sha (exact code state)│
│  repository        full_diff  ◄── store at      │
│  pr_number                        review time   │
│  rendered_prompt  ◄── exact string sent to LLM  │
│  config_snapshot  ◄── rules + model version     │
│  validation_failures[]                          │
│  llm_findings[]                                 │
│  gate_status       severity_breakdown           │
│  token_usage       cost_usd    latency_ms       │
│  human_feedback:   null  ◄── filled in later    │
│  outcome_labels:   null  ◄── computed later     │
└─────────────────────────────────────────────────┘
    │
    ▼
PR comment posted + metrics recorded
    │
    │         (hours or days later)
    │
    ▼
Developer provides feedback via one of three channels
    │
    ├── A. Reacts 👍 / 👎 on the PR comment
    │         GitHub webhook → POST /api/training/feedback
    │
    ├── B. Clicks Accept / Reject / Modify in the
    │      observability dashboard drill-down view
    │         Dashboard → POST /api/training/feedback
    │
    └── C. Resolves or dismisses inline PR review thread
              pull_request_review webhook → POST /api/training/feedback
    │
    ▼
Outcome labels computed and stored
    │
    ▼
Dataset grows  →  weekly export  →  model fine-tune  →  drift comparison
```

---

### Database Schema

The existing SQLite database (volume `metrics_data`) already holds `metrics` and `run_details`. Three new tables extend it:

```
  run_details (existing)
       │
       │ linked via run_id
       ▼
┌─────────────────────────────────┐
│       training_records          │
│─────────────────────────────────│
│ id               auto increment │
│ run_id           unique         │
│ schema_version   "1.0"          │
│ created_at       immutable      │
│ repository                      │
│ commit_sha                      │
│ pr_number                       │
│ branch / base_branch            │
│ actor                           │
│ full_diff        TEXT           │  ← entire git diff, verbatim
│ rendered_prompt  TEXT           │  ← exact prompt sent to LLM
│ prompt_template_version         │  ← "2.1" etc
│ validation_rules_config  JSON   │  ← snapshot of active rules
│ model_version                   │
│ validation_failures  JSON       │
│ llm_findings         JSON       │
│ per_file_results     JSON       │
│ severity_breakdown   JSON       │
│ gate_status                     │
│ total_issues                    │
│ token_usage          JSON       │
│ cost_usd                        │
│ latency_ms                      │
│ source               "pipeline" │
└──────────────┬──────────────────┘
               │ 1 record : many feedback rows
               ▼
┌─────────────────────────────────┐
│       training_feedback         │
│─────────────────────────────────│
│ id               auto increment │
│ record_id        FK             │
│ finding_id       null=gate level│
│ action           accept         │
│                  reject         │
│                  modify         │
│ reason           TEXT           │
│ corrected_findings  JSON        │  ← what the correct finding should be
│ reviewer_id      GitHub username│
│ feedback_channel gh│dashboard│pr│
│ created_at       immutable      │
└──────────────┬──────────────────┘
               │ triggers label computation
               ▼
┌─────────────────────────────────┐
│       training_labels           │
│─────────────────────────────────│
│ record_id        FK             │
│ true_positives   INT            │  ← findings accepted by human
│ false_positives  INT            │  ← findings rejected by human
│ false_negatives  INT            │  ← issues human added that AI missed
│ precision        FLOAT          │
│ recall           FLOAT          │
│ gate_correct     BOOL           │  ← did human agree with pass/fail?
│ rl_reward        FLOAT -1 to +1 │
│ supervised_label               │
│   correct | false_positive      │
│   false_negative | partial      │
│ computed_at                     │
└─────────────────────────────────┘
```

> **Append-only guarantee:** No `DELETE` or `UPDATE` ever runs on `training_records` or `training_feedback`. Human feedback appends new rows — it never overwrites prior ones. This preserves the full history of how reviewer opinion evolved on any given finding.

---

### Human Feedback Channels

All three channels write to the same `training_feedback` table:

#### Channel A — GitHub PR Comment

```
❌ AI Code Review — FAILED
...findings...

Developer reacts 👍 (accept) or 👎 (reject)
or replies: "false positive — already parameterised"
         │
         ▼  GitHub webhook
POST /api/training/feedback
```

#### Channel B — Observability Dashboard

The existing drill-down view in the Pipeline tab gains feedback buttons per finding:

```
Finding #1  [CRITICAL]  SQL injection  api/users.ts:42
  [ ✅ Accept ]  [ ❌ Reject ]  [ ✏️ Modify ]

Finding #2  [HIGH]  Auth check after data fetch  api/orders.ts:18
  [ ✅ Accept ]  [ ❌ Reject ]  [ ✏️ Modify ]

Gate decision: FAIL
  [ ✅ Agree with gate ]  [ ❌ Disagree ]
```

#### Channel C — GitHub PR Review Thread

When a developer resolves or dismisses an inline comment, a `pull_request_review` webhook fires and maps to a feedback row automatically.

---

### Outcome Labels

Labels are computed as soon as feedback arrives:

```
findings accepted by human  →  true_positives
findings rejected by human  →  false_positives
issues added by human       →  false_negatives  (AI missed these)

precision  =  true_positives / (true_positives + false_positives)
recall     =  true_positives / (true_positives + false_negatives)


RL reward signal:
  all findings accepted  →  reward = +1.0
  50 / 50 mix            →  reward =  0.0
  all findings rejected  →  reward = -1.0


Supervised learning label:
  "correct"          gate agreed, all findings accepted
  "false_positive"   gate was FAIL but human says it should PASS
  "false_negative"   gate was PASS but human found real issues
  "partial"          some findings accepted, some rejected
```

---

### Export API

A `GET /api/training/export` endpoint makes the dataset available for offline training:

| Parameter | Description |
|-----------|-------------|
| `format=jsonl` | One self-contained record per line (default) |
| `format=parquet` | Columnar format for large-scale analysis |
| `labeled=true` | Only records that have received human feedback |
| `model_version=v2` | Filter by model version |
| `from` / `to` | Date range filter |

Each exported record is fully self-contained — no external lookups needed:

```json
{
  "schema_version": "1.0",
  "id": "uuid",
  "created_at": "2025-06-01T14:32:00Z",
  "repository": "org/myapp",
  "commit_sha": "abc123",
  "full_diff": "--- a/api/users.ts\n+++ b/api/users.ts\n...",
  "rendered_prompt": "You are a senior engineer reviewing a pull request...",
  "prompt_template_version": "2.1",
  "model_version": "claude-opus-4-6",
  "validation_rules_config": { "version": "1.4", "rules": [ "..." ] },
  "llm_findings": [ { "severity": "high", "file": "api/users.ts", "line_number": 42, "message": "..." } ],
  "validation_failures": [ { "severity": "critical", "category": "security", "message": "..." } ],
  "gate_status": "fail",
  "human_feedback": [
    { "action": "reject", "reason": "already parameterised", "feedback_channel": "gh" }
  ],
  "outcome_labels": {
    "precision": 0.67,
    "recall": 1.0,
    "rl_reward": 0.33,
    "supervised_label": "partial"
  }
}
```

---

### Model Drift Detection

Because every record is tagged with `model_version`, precision and recall can be tracked across versions over time:

```
Model v1 (Jan–Mar)     Model v2 (Apr–Jun)     Model v3 (Jul–Sep)
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ precision  0.71  │   │ precision  0.84  │   │ precision  0.79  │ ← dropped
│ recall     0.65  │   │ recall     0.78  │   │ recall     0.81  │
│ fp_rate    0.29  │   │ fp_rate    0.16  │   │ fp_rate    0.21  │ ← rose
└──────────────────┘   └──────────────────┘   └──────────────────┘
                                                       │
                                               drift alert fires
                                               → trigger retraining
                                                 using v2 + v3 records
```

When precision drops or false-positive rate rises beyond a threshold compared to the previous version's baseline, a drift alert is surfaced on the observability dashboard and retraining is triggered using the accumulated labeled dataset.

---

## Adopting This In Your Repo

1. Copy `.github/workflows/caller-template.yml` into your repository
2. Add secrets `AI_AGENT_API_URL` and `AI_AGENT_API_KEY`
3. Open a pull request — the review runs automatically

The workflow is configurable per repository:

```yaml
with:
  max_files: 20                              # max files to review per PR
  file_extensions: .py,.ts,.tsx,.js,.jsx    # extensions to include
  timeout_minutes: 30                        # job timeout
```
