import { Box, Paper, Typography, Divider, Alert, Chip, Tabs, Tab, Stepper, Step, StepLabel, StepContent } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import StorageIcon from '@mui/icons-material/Storage';
import GitHubIcon from '@mui/icons-material/GitHub';
import SettingsIcon from '@mui/icons-material/Settings';
import { useState } from 'react';

export default function DynamicRulesPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <SyncIcon sx={{ fontSize: 32, color: '#8B5CF6' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Dynamic Rules Management
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Update rules across 1000 pipelines without changing workflow files
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Current Problem */}
        <Alert severity="warning" sx={{ mb: 4 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Current Limitation
          </Typography>
          <Typography variant="body2">
            Rules are currently <strong>hardcoded</strong> in <code>server/engine/pattern-rules.ts</code>.
            To update rules across 1000 pipelines, you need to update the code file, redeploy, or update
            all 1000 workflow files to point to a new repository version. This is not scalable.
          </Typography>
        </Alert>

        {/* Current Architecture */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Current Architecture (Two Separate Rule Stores)
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(99, 102, 241, 0.05)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Frontend Rules (Web UI)
              </Typography>
              <Typography variant="body2" fontSize="0.85rem" color="text.secondary" paragraph>
                • Location: <code>src/engine/validation-rules.ts</code><br/>
                • Storage: Browser localStorage<br/>
                • Management: Rules Management page<br/>
                • Scope: Web UI reviews only<br/>
                • ❌ Not used by CI/CD pipelines
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(239, 68, 68, 0.05)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Backend Rules (CI/CD)
              </Typography>
              <Typography variant="body2" fontSize="0.85rem" color="text.secondary" paragraph>
                • Location: <code>server/engine/pattern-rules.ts</code><br/>
                • Storage: Hardcoded in file<br/>
                • Used by: <code>ci-review.ts</code> CLI tool<br/>
                • Scope: All CI/CD pipeline reviews<br/>
                • ❌ Requires code changes to update
              </Typography>
            </Paper>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Rules Flow in CI/CD:</strong> GitHub Action → ci-review.ts CLI → /api/review/batch → pattern-rules.ts (hardcoded)
            </Typography>
          </Alert>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* Solution Options */}
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Solutions for Dynamic Rule Updates
        </Typography>

        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Centralized API (Recommended)" icon={<StorageIcon />} iconPosition="start" />
          <Tab label="Git-Based Config" icon={<GitHubIcon />} iconPosition="start" />
          <Tab label="Environment Variables" icon={<SettingsIcon />} iconPosition="start" />
        </Tabs>

        {/* Option 1: Centralized API */}
        {activeTab === 0 && (
          <Box>
            <Alert severity="success" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600}>
                ⭐ Recommended for 1000+ Pipelines
              </Typography>
              <Typography variant="body2">
                Deploy a centralized Code Review server that all pipelines call. Update rules once → affects all repos instantly.
              </Typography>
            </Alert>

            <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
              Architecture Overview
            </Typography>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)', mb: 3 }}>
              <Box
                component="pre"
                sx={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  whiteSpace: 'pre',
                }}
              >
{`┌─────────────────────────────────────────────────────────┐
│         Centralized Code Review Server                  │
│         https://code-review.company.com                  │
│                                                          │
│  ┌────────────────┐      ┌──────────────────┐          │
│  │  Rules API     │◄────►│  Rules Database  │          │
│  │  /api/rules    │      │  (PostgreSQL)    │          │
│  └────────────────┘      └──────────────────┘          │
│           ▲                                             │
│           │                                             │
│  ┌────────┴────────┐                                   │
│  │  Review API     │                                   │
│  │  /api/review    │                                   │
│  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
           ▲        ▲        ▲
           │        │        │
    ┌──────┴───┬────┴───┬────┴──────┐
    │  Repo 1  │ Repo 2 │  Repo 1000│
    │  GHA     │  GHA   │   GHA     │
    └──────────┴────────┴───────────┘`}
              </Box>
              <Typography variant="caption" color="text.secondary">
                All pipelines call the same server. Updates affect all repos immediately.
              </Typography>
            </Paper>

            <Stepper orientation="vertical">
              <Step active>
                <StepLabel>Create Rules Database</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Store rules in PostgreSQL with versioning and audit trails:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                    }}
                  >
{`CREATE TABLE rules (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  pattern TEXT,
  pattern_flags VARCHAR(10),
  severity VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  languages JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(100)
);`}
                  </Box>
                </StepContent>
              </Step>

              <Step active>
                <StepLabel>Add Rules Management API</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Create REST API endpoints for CRUD operations on rules:
                  </Typography>
                  <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', '& div': { mb: 0.5 } }}>
                    <div>• GET /api/rules - List all rules</div>
                    <div>• POST /api/rules - Create new rule</div>
                    <div>• PUT /api/rules/:id - Update rule</div>
                    <div>• DELETE /api/rules/:id - Delete rule</div>
                    <div>• POST /api/rules/bulk-update - Update multiple rules</div>
                  </Box>
                </StepContent>
              </Step>

              <Step active>
                <StepLabel>Modify Review API to Load Dynamic Rules</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Update pattern-rules.ts to query database instead of using hardcoded rules:
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                    }}
                  >
{`export async function getActiveRules(language?: string) {
  let query = 'SELECT * FROM rules WHERE enabled = true';
  const params: any[] = [];
  
  if (language) {
    query += ' AND languages @> $1';
    params.push(JSON.stringify([language]));
  }
  
  const result = await db.query(query, params);
  
  return result.rows.map(row => ({
    id: row.id,
    pattern: row.pattern ? new RegExp(row.pattern) : undefined,
    // ... map other fields
  }));
}`}
                  </Box>
                </StepContent>
              </Step>

              <Step active>
                <StepLabel>Update GitHub Actions to Use Centralized Server</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    All workflows point to the centralized API (one-time change):
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                    }}
                  >
{`# Set this once in GitHub Organization Secrets
CODE_REVIEW_API_URL=https://code-review.company.com/api

# All 1000 workflows use the same config
- name: Run Code Review Gate
  env:
    CODE_REVIEW_API_URL: \${{ secrets.CODE_REVIEW_API_URL }}
    ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
  run: npx tsx ci-review.ts --threshold 75`}
                  </Box>
                </StepContent>
              </Step>

              <Step active>
                <StepLabel>Manage Rules via UI</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Use the Rules Management page to add/edit/delete rules. Changes take effect immediately across all 1000 pipelines.
                  </Typography>
                </StepContent>
              </Step>
            </Stepper>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Benefits:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Update once → affects all repos" color="success" size="small" />
                <Chip label="No workflow file changes" color="success" size="small" />
                <Chip label="Centralized audit log" color="success" size="small" />
                <Chip label="Role-based access control" color="success" size="small" />
                <Chip label="Version history tracking" color="success" size="small" />
                <Chip label="A/B testing capabilities" color="success" size="small" />
              </Box>
            </Box>
          </Box>
        )}

        {/* Option 2: Git-Based Config */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Store rules in a centralized Git repository that all pipelines clone at runtime.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)', mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Repository Structure
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              >
{`github.com/company/code-review-rules/
├── rules/
│   ├── pyspark.json
│   ├── scala.json
│   ├── sql.json
│   └── terraform.json
├── schemas/
│   └── rule-schema.json
└── README.md`}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)', mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                GitHub Actions Workflow
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              >
{`jobs:
  code-review:
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Checkout rules repository
        uses: actions/checkout@v3
        with:
          repository: company/code-review-rules
          token: \${{ secrets.RULES_REPO_TOKEN }}
          path: rules
      
      - name: Run Code Review
        env:
          RULES_DIR: ./rules
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          npm install
          npm run server &
          sleep 10
          npx tsx scripts/ci-review.ts --threshold 75`}
              </Box>
            </Paper>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Benefits:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Git version control" color="primary" size="small" />
                <Chip label="Pull request workflow" color="primary" size="small" />
                <Chip label="Branch protection" color="primary" size="small" />
                <Chip label="Works with existing Git infra" color="primary" size="small" />
              </Box>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ mt: 2 }}>
                Limitations:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Requires workflow file changes" color="warning" size="small" />
                <Chip label="Each job clones rules repo" color="warning" size="small" />
                <Chip label="Not instant - waits for next run" color="warning" size="small" />
              </Box>
            </Box>
          </Box>
        )}

        {/* Option 3: Environment Variables */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Store frequently toggled settings as environment variables in your CI/CD platform.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)', mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                GitHub Organization Variables
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', '& div': { mb: 0.5, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 } }}>
                <div>REVIEW_THRESHOLD = 75</div>
                <div>DISABLED_RULES = pyspark-002,scala-003,sql-009</div>
                <div>CRITICAL_ONLY_MODE = false</div>
                <div>FAIL_ON_HIGH = true</div>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)', mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Code Implementation
              </Typography>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                }}
              >
{`// server/engine/pattern-rules.ts
export function getActiveRules() {
  const disabledRules = (process.env.DISABLED_RULES || '')
    .split(',')
    .map(s => s.trim());
  
  return allRules.filter(r => !disabledRules.includes(r.id));
}

// scripts/ci-review.ts
const threshold = parseInt(process.env.REVIEW_THRESHOLD || '70');
const failOnHigh = process.env.FAIL_ON_HIGH === 'true';`}
              </Box>
            </Paper>

            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Benefits:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                <Chip label="Quick toggle" color="primary" size="small" />
                <Chip label="Org-level or repo-level" color="primary" size="small" />
                <Chip label="No code changes" color="primary" size="small" />
              </Box>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Limitations:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label="Only enable/disable" color="error" size="small" />
                <Chip label="Can't change rule content" color="error" size="small" />
                <Chip label="Limited scalability" color="error" size="small" />
              </Box>
            </Box>
          </Box>
        )}

        <Divider sx={{ my: 4 }} />

        {/* Recommendation */}
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Recommendation for 1000 Pipelines
          </Typography>

          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Use Option 1: Centralized Rules API
            </Typography>
            <Typography variant="body2">
              This is the only solution that provides instant updates, zero workflow changes after initial setup,
              and enterprise-grade features like audit logging, RBAC, and rule versioning.
            </Typography>
          </Alert>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Migration Path:
            </Typography>
            <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
              <li><Typography variant="body2">Deploy centralized server with initial hardcoded rules</Typography></li>
              <li><Typography variant="body2">Add PostgreSQL database and Rules Management API</Typography></li>
              <li><Typography variant="body2">Update org secrets: CODE_REVIEW_API_URL=https://code-review.company.com/api</Typography></li>
              <li><Typography variant="body2">Update workflows to use centralized API (one-time change to 1000 files)</Typography></li>
              <li><Typography variant="body2">Future rule updates via UI → affects all repos instantly, no workflow changes</Typography></li>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(99, 102, 241, 0.05)', mt: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Advanced Features with Centralized API:
            </Typography>
            <Box component="ul" sx={{ pl: 3, '& li': { mb: 1 } }}>
              <li><Typography variant="body2">Environment-specific rules (dev/staging/prod)</Typography></li>
              <li><Typography variant="body2">A/B testing different rule configurations</Typography></li>
              <li><Typography variant="body2">Scheduled rule enablement (e.g., stricter rules after Q1)</Typography></li>
              <li><Typography variant="body2">Per-repository rule overrides</Typography></li>
              <li><Typography variant="body2">Cost tracking per rule and repository</Typography></li>
              <li><Typography variant="body2">Rule performance analytics</Typography></li>
            </Box>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}
