import { Box, Paper, Typography, Divider, Alert, Stepper, Step, StepLabel, StepContent } from '@mui/material';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';

export default function ExistingWorkflowIntegrationPage() {
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
          <IntegrationInstructionsIcon sx={{ fontSize: 32, color: '#6366F1' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Integrating with Existing Workflows
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add code review gate to your existing CI/CD pipelines
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Overview */}
        <Alert severity="info" sx={{ mb: 4 }}>
          You don't need to replace your existing workflows. The code review assistant can be added as a new job
          that runs in parallel or as a gate before deployment jobs.
        </Alert>

        {/* Integration Patterns */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Integration Patterns
          </Typography>

          <Stepper orientation="vertical">
            <Step active>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight={600}>
                  Pattern 1: Separate Review Job (Recommended)
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Add a new job that runs the code review. Make your deploy job depend on it.
                </Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', border: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight={700} gutterBottom display="block">
                    GitHub Actions Example:
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
  # Your existing build job
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build application
        run: npm run build
  
  # Your existing tests
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: npm test
  
  # NEW: Add code review job
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install review tool
        run: |
          npm install -g typescript tsx
          npm install @anthropic-ai/sdk glob dotenv express cors
      
      - name: Start Review Server
        run: |
          git clone https://github.com/your-org/AI-CodeReview-Assistant.git review-tool
          cd review-tool
          npm install
          npm run server &
          sleep 10
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          PORT: 5001
      
      - name: Review Changed Files
        run: |
          cd review-tool
          git diff --name-only origin/\${{ github.base_ref }}...HEAD | \\
            grep -E '\\.(py|scala|sql|tf)$' | \\
            xargs npx tsx scripts/ci-review.ts \\
              --threshold 70 \\
              --fail-on-critical \\
              --format json \\
              --output ../review-results.json
        env:
          CODE_REVIEW_API_URL: http://localhost:5001/api
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: code-review-results
          path: review-results.json
  
  # Your existing deploy job - NOW with dependency
  deploy:
    needs: [build, test, code-review]  # Add code-review here
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: ./deploy.sh`}
                  </Box>
                </Paper>
              </StepContent>
            </Step>

            <Step active>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight={600}>
                  Pattern 2: Add to Existing Job
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Add code review steps to your existing CI job before deployment.
                </Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', border: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight={700} gutterBottom display="block">
                    Add to your existing job:
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
  ci-cd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Your existing steps
      - name: Build
        run: npm run build
      
      - name: Test
        run: npm test
      
      # NEW: Add code review steps before deploy
      - name: Setup code review
        run: |
          npm install -g typescript tsx
          npm install @anthropic-ai/sdk glob dotenv express cors
          git clone https://github.com/your-org/AI-CodeReview-Assistant.git review-tool
          cd review-tool && npm install
      
      - name: Run code review gate
        run: |
          cd review-tool
          npm run server &
          sleep 10
          git diff --name-only HEAD~1 HEAD | \\
            grep -E '\\.(py|scala|sql|tf)$' | \\
            xargs npx tsx scripts/ci-review.ts --threshold 75 --fail-on-critical
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      
      # Your existing deploy step - only runs if review passes
      - name: Deploy
        if: success()
        run: ./deploy.sh`}
                  </Box>
                </Paper>
              </StepContent>
            </Step>

            <Step active>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight={600}>
                  Pattern 3: Standalone Review Workflow
                </Typography>
              </StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Create a separate workflow file that blocks merging via branch protection rules.
                </Typography>
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.02)', border: 1, borderColor: 'divider' }}>
                  <Typography variant="caption" fontWeight={700} gutterBottom display="block">
                    .github/workflows/code-quality-gate.yml (new file):
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
{`name: Code Quality Gate

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup Review Tool
        run: |
          npm install -g typescript tsx
          npm install @anthropic-ai/sdk glob dotenv express cors
          git clone https://github.com/your-org/AI-CodeReview-Assistant.git review-tool
          cd review-tool && npm install
      
      - name: Start Review Server
        run: |
          cd review-tool
          npm run server &
          sleep 10
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Run Quality Gate
        id: review
        run: |
          cd review-tool
          git diff --name-only origin/\${{ github.base_ref }}...HEAD | \\
            grep -E '\\.(py|scala|sql|tf)$' | \\
            xargs npx tsx scripts/ci-review.ts \\
              --threshold 75 \\
              --fail-on-critical \\
              --format json \\
              --output ../review-results.json
        env:
          CODE_REVIEW_API_URL: http://localhost:5001/api
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Comment Results on PR
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('review-results.json', 'utf8'));
            const summary = results.summary;
            
            const status = summary.passThreshold ? '✅ PASSED' : '❌ FAILED';
            const comment = \`## Code Quality Review \${status}
            
            **Score:** \${summary.averageScore}/100
            **Threshold:** 75/100
            
            ### Issues Found
            - 🔴 Critical: \${summary.criticalCount}
            - 🟠 High: \${summary.highCount}
            - 🟡 Medium: \${summary.mediumCount}
            - 🟢 Low: \${summary.lowCount}
            
            \${summary.passThreshold ? '✅ Quality gate passed! Ready to merge.' : '❌ Quality gate failed. Please address the issues above.'}\`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });

# Then in your main workflow, keep it simple:
# .github/workflows/main.yml
name: CI/CD
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        run: ./deploy.sh

# Enable branch protection:
# Settings → Branches → Add rule for 'main'
# ✓ Require status checks: "Code Quality Gate / quality-check"`}
                  </Box>
                </Paper>
              </StepContent>
            </Step>
          </Stepper>
        </Box>

        <Divider sx={{ my: 4 }} />

        {/* GitHub Actions Integration */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            GitHub Actions CI
          </Typography>
          
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              If you already have a .github/workflows file with deploy jobs:
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
{`name: CI/CD Pipeline

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  # Your existing jobs
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build
        run: npm run build

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test
        run: npm test

  # ADD THIS NEW JOB
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Run Code Review Gate
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          CODE_REVIEW_API_URL: "http://localhost:5001/api"
        run: |
          npm install -g typescript tsx
          npm install @anthropic-ai/sdk glob dotenv express cors
          git clone https://github.com/your-org/ai-code-review-assistant.git review-tool
          cd review-tool && npm install
          npm run server &
          sleep 10
          cd ..
          git diff --name-only origin/\${{ github.base_ref }}...HEAD | grep -E '\\.(py|scala|sql|tf)$' | xargs npx tsx review-tool/scripts/ci-review.ts --threshold 75 --fail-on-critical --format json --output review.json
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: review.json

  # Your existing deploy job - now depends on review
  deploy:
    runs-on: ubuntu-latest
    needs: [build, test, code-review]  # ADD code-review dependency
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - name: Deploy
        run: ./deploy.sh`}
            </Box>
          </Paper>
        </Box>

        {/* Quick Migration Checklist */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Quick Migration Checklist
          </Typography>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Box component="ol" sx={{ pl: 2, '& li': { mb: 2 } }}>
              <li>
                <Typography variant="body2">
                  <strong>Add API Key Secret:</strong> Store your ANTHROPIC_API_KEY in CI/CD secrets
                  <Box component="code" sx={{ display: 'block', mt: 0.5, p: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 0.5, fontSize: '0.8rem' }}>
                    GitHub: Settings → Secrets → Actions → New secret<br/>
                    GitLab: Settings → CI/CD → Variables → Add variable
                  </Box>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Clone/Install Tool:</strong> Add steps to install the code review tool in your pipeline
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Start Server:</strong> Run <code>npm run server &</code> in background before review
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Run Review:</strong> Execute the CLI with your desired threshold and fail criteria
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Add Dependencies:</strong> Make deploy jobs depend on code-review job passing
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Test:</strong> Create a test PR to verify the gate works correctly
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  <strong>Adjust Thresholds:</strong> Fine-tune threshold values based on your codebase quality
                </Typography>
              </li>
            </Box>
          </Paper>
        </Box>

        {/* File Filtering */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            File Filtering Examples
          </Typography>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Review only changed files in PR:
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
                mb: 2,
              }}
            >
{`# GitHub Actions
git diff --name-only origin/\${{ github.base_ref }}...HEAD | grep -E '\\.(py|scala|sql|tf)$'

# GitLab CI
git diff --name-only $CI_MERGE_REQUEST_DIFF_BASE_SHA...HEAD | grep -E '\\.(py|scala|sql|tf)$'`}
            </Box>

            <Typography variant="body2" fontWeight={600} gutterBottom>
              Review specific directories only:
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
                mb: 2,
              }}
            >
{`git diff --name-only HEAD~1 HEAD | grep -E '^(src|lib)/.*\\.(py|scala)$'`}
            </Box>

            <Typography variant="body2" fontWeight={600} gutterBottom>
              Review all Python files in project:
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
{`find . -name "*.py" -not -path "*/node_modules/*" -not -path "*/venv/*"`}
            </Box>
          </Paper>
        </Box>

        {/* Troubleshooting */}
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Common Issues
          </Typography>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Box sx={{ '& > div': { mb: 2 } }}>
              <Box>
                <Typography variant="body2" fontWeight={600} color="error">
                  Issue: "API key not configured"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Solution: Ensure ANTHROPIC_API_KEY is set in CI secrets and passed as environment variable
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={600} color="error">
                  Issue: "Connection refused to localhost:5001"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Solution: Add <code>sleep 10</code> after starting server, or check server logs for startup errors
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={600} color="error">
                  Issue: "No files to review"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Solution: Verify your file filter regex matches your code files. Use <code>--verbose</code> flag to debug
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" fontWeight={600} color="error">
                  Issue: Deploy still runs when review fails
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Solution: Add <code>needs: [code-review]</code> to deploy job and ensure <code>allow_failure: false</code>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}
