import { Box, Paper, Typography, Divider, Alert, Chip, Tab, Tabs } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import GitHubIcon from '@mui/icons-material/GitHub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useState } from 'react';

export default function CICDIntegrationPage() {
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
          <BuildIcon sx={{ fontSize: 32, color: '#10B981' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              CI/CD Integration Guide
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Integrate Code Review Assistant as a quality gate in your deployment pipeline
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Overview */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            The Code Review Assistant can be integrated into your CI/CD pipeline to automatically analyze code changes
            and gate deployments based on code quality scores, severity thresholds, and custom validation criteria.
            This ensures only high-quality code reaches production.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            The CLI tool supports multiple output formats (JSON, Markdown, SARIF) and configurable failure criteria
            to fit various CI/CD workflows and quality requirements.
          </Alert>
        </Box>

        {/* Tabs for different CI/CD platforms */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="GitHub Actions" />
          <Tab label="GitLab CI" />
          <Tab label="Jenkins" />
          <Tab label="Azure DevOps" />
        </Tabs>

        {/* GitHub Actions */}
        {activeTab === 0 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <GitHubIcon /> GitHub Actions Integration
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                ⚡ Best Practice: Run on Pull Request Events
              </Typography>
              <Typography variant="body2">
                Trigger the workflow when a <strong>PR is opened or updated</strong> targeting develop/main branches.
                Do NOT run on every push to feature branches - this wastes API costs and interrupts development.
                Reviews should be a quality gate before merge, not during active coding.
              </Typography>
            </Alert>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                .github/workflows/code-review.yml
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
{`name: AI Code Review

on:
  pull_request:
    branches: [main, develop]  # Trigger when PR targets these branches
    types: [opened, synchronize, reopened]  # On PR open, new commits, or reopen
    paths:  # Optional: Only run for code files (saves costs)
      - '**.py'
      - '**.scala'
      - '**.sql'
      - '**.tf'
  # Optional: Validate after merge to main
  push:
    branches: [main]

jobs:
  code-review:
    # Skip draft PRs to save costs
    if: github.event.pull_request.draft == false || github.event_name == 'push'
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install -g typescript tsx
          npm install @anthropic-ai/sdk glob dotenv
      
      - name: Start Code Review Server
        run: |
          npm install
          npm run server &
          sleep 10
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          PORT: 5001
      
      - name: Run Code Review with Quality Gate
        run: |
          # Get changed files in PR
          CHANGED_FILES=$(git diff --name-only origin/main...HEAD | grep -E '\\.(py|scala|sql|tf)$' || true)
          
          if [ -z "$CHANGED_FILES" ]; then
            echo "No code files changed"
            exit 0
          fi
          
          # Run review with threshold and fail conditions
          npx tsx scripts/ci-review.ts \\
            --threshold 75 \\
            --fail-on-critical \\
            --fail-on-high \\
            --format sarif \\
            --output code-review-results.sarif \\
            $CHANGED_FILES
        env:
          CODE_REVIEW_API_URL: http://localhost:5001/api
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Upload SARIF results
        if: always()
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: code-review-results.sarif
      
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('code-review-results.sarif'));
            // Post results as PR comment
            // (implementation details omitted for brevity)`}
              </Box>
            </Paper>

            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Quality Gate Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              The pipeline fails the build if any of these conditions are met:
            </Typography>
            <Box component="ul" sx={{ pl: 3 }}>
              <li><Typography variant="body2"><code>--threshold 75</code> - Average score below 75/100</Typography></li>
              <li><Typography variant="body2"><code>--fail-on-critical</code> - Any critical severity issues found</Typography></li>
              <li><Typography variant="body2"><code>--fail-on-high</code> - Any high severity issues found</Typography></li>
            </Box>
          </Box>
        )}

        {/* GitLab CI */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              GitLab CI Integration
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                ⚡ Best Practice: Run on Merge Request Events
              </Typography>
              <Typography variant="body2">
                Use <code>only: merge_requests</code> to trigger when an MR is created or updated targeting develop/main.
                Avoid running on every branch push to reduce API costs and improve developer experience.
              </Typography>
            </Alert>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                .gitlab-ci.yml
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
{`stages:
  - test
  - review
  - deploy

code_review:
  stage: review
  image: node:18
  before_script:
    - npm install -g typescript tsx
    - npm install @anthropic-ai/sdk glob dotenv
    - npm install
  script:
    # Start server in background
    - npm run server &
    - sleep 10
    
    # Get changed files
    - git diff-tree --no-commit-id --name-only -r $CI_COMMIT_SHA | grep -E '\\.(py|scala|sql|tf)$' > changed_files.txt || true
    
    # Run review with quality gates
    - |
      if [ -s changed_files.txt ]; then
        cat changed_files.txt | xargs npx tsx scripts/ci-review.ts \\
          --threshold 80 \\
          --fail-on-critical \\
          --format json \\
          --output code-review.json
      else
        echo "No code files to review"
      fi
  variables:
    CODE_REVIEW_API_URL: "http://localhost:5001/api"
    ANTHROPIC_API_KEY: $ANTHROPIC_API_KEY
  artifacts:
    reports:
      codequality: code-review.json
    paths:
      - code-review.json
    expire_in: 1 week
  allow_failure: false  # Fails pipeline if review finds issues
  only:
    - merge_requests  # Run when MR is opened/updated (RECOMMENDED)
    - main            # Optional: Also run on commits to main
  rules:  # Advanced: Target specific branches
    - if: '$CI_MERGE_REQUEST_TARGET_BRANCH == "develop"'
    - if: '$CI_MERGE_REQUEST_TARGET_BRANCH == "main"'
    - if: '$CI_COMMIT_BRANCH == "main"'

deploy_production:
  stage: deploy
  needs: [code_review]
  script:
    - echo "Deploying to production..."
    # Deployment commands
  only:
    - main
  when: on_success`}
              </Box>
            </Paper>
          </Box>
        )}

        {/* Jenkins */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Jenkins Pipeline Integration
            </Typography>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Jenkinsfile
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
{`pipeline {
    agent any
    
    environment {
        ANTHROPIC_API_KEY = credentials('anthropic-api-key')
        CODE_REVIEW_API_URL = 'http://localhost:5001/api'
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g typescript tsx'
                sh 'npm install @anthropic-ai/sdk glob dotenv'
                sh 'npm install'
            }
        }
        
        stage('Start Review Server') {
            steps {
                sh 'npm run server &'
                sh 'sleep 10'
            }
        }
        
        stage('Code Review Quality Gate') {
            steps {
                script {
                    def changedFiles = sh(
                        script: "git diff --name-only HEAD^ HEAD | grep -E '\\\\.(py|scala|sql|tf)\$' || true",
                        returnStdout: true
                    ).trim()
                    
                    if (changedFiles) {
                        sh """
                            echo "${changedFiles}" | xargs npx tsx scripts/ci-review.ts \\
                                --threshold 70 \\
                                --fail-on-critical \\
                                --format json \\
                                --output code-review-results.json
                        """
                        
                        // Publish results
                        def results = readJSON file: 'code-review-results.json'
                        echo "Code Review Score: ${results.summary.averageScore}/100"
                        
                        if (!results.summary.passThreshold) {
                            error("Code quality below threshold")
                        }
                    } else {
                        echo "No code files changed"
                    }
                }
            }
        }
        
        stage('Deploy') {
            when {
                expression { currentBuild.result == 'SUCCESS' }
            }
            steps {
                echo 'Deploying application...'
                // Deployment steps
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: 'code-review-results.json', allowEmptyArchive: true
        }
    }
}`}
              </Box>
            </Paper>
          </Box>
        )}

        {/* Azure DevOps */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Azure DevOps Pipeline Integration
            </Typography>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                azure-pipelines.yml
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
{`trigger:
  - main
  - develop

pr:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  - group: code-review-secrets
  - name: CODE_REVIEW_API_URL
    value: 'http://localhost:5001/api'

stages:
  - stage: CodeReview
    displayName: 'Code Review Quality Gate'
    jobs:
      - job: Review
        displayName: 'AI Code Review'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'
          
          - script: |
              npm install -g typescript tsx
              npm install @anthropic-ai/sdk glob dotenv
              npm install
            displayName: 'Install dependencies'
          
          - script: |
              npm run server &
              sleep 10
            displayName: 'Start Review Server'
            env:
              ANTHROPIC_API_KEY: $(ANTHROPIC_API_KEY)
          
          - script: |
              git diff --name-only HEAD~1 HEAD | grep -E '\\.(py|scala|sql|tf)$' > changed_files.txt || true
              
              if [ -s changed_files.txt ]; then
                cat changed_files.txt | xargs npx tsx scripts/ci-review.ts \\
                  --threshold 75 \\
                  --fail-on-critical \\
                  --format json \\
                  --output $(Build.ArtifactStagingDirectory)/code-review.json
              else
                echo "No files to review"
                echo '{"summary":{"passThreshold":true}}' > $(Build.ArtifactStagingDirectory)/code-review.json
              fi
            displayName: 'Run Code Review'
            env:
              CODE_REVIEW_API_URL: $(CODE_REVIEW_API_URL)
              ANTHROPIC_API_KEY: $(ANTHROPIC_API_KEY)
          
          - task: PublishBuildArtifacts@1
            inputs:
              pathToPublish: '$(Build.ArtifactStagingDirectory)'
              artifactName: 'code-review-results'
            displayName: 'Publish Review Results'

  - stage: Deploy
    displayName: 'Deploy Application'
    dependsOn: CodeReview
    condition: succeeded()
    jobs:
      - job: DeployProd
        displayName: 'Deploy to Production'
        steps:
          - script: echo "Deploying..."
            displayName: 'Deploy Application'`}
              </Box>
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 4 }} />

        {/* CLI Options Reference */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            CLI Options Reference
          </Typography>
          
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                  --threshold &lt;number&gt;
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Minimum average score (0-100) required to pass. Default: 70
                </Typography>
                <Chip label="Quality Gate" size="small" sx={{ mt: 0.5 }} />
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                  --fail-on-critical
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fail the build if any critical severity issues are found
                </Typography>
                <Chip label="Severity Gate" size="small" color="error" sx={{ mt: 0.5 }} />
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                  --fail-on-high
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fail the build if any high severity issues are found
                </Typography>
                <Chip label="Severity Gate" size="small" color="warning" sx={{ mt: 0.5 }} />
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                  --format &lt;type&gt;
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Output format: json, markdown, sarif, summary. Default: summary
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                  --output &lt;file&gt;
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Write results to file instead of stdout
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" fontWeight={700} fontFamily="monospace">
                  --api-url &lt;url&gt;
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Backend API URL. Default: http://localhost:5001/api
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Scoring System */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Scoring System
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            The code review generates four category scores that combine into an overall quality score:
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} color="#EC4899" gutterBottom>
                Performance Score
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Evaluates runtime efficiency, algorithm complexity, resource usage, and optimization opportunities.
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} color="#EF4444" gutterBottom>
                Security Score
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Identifies vulnerabilities, injection risks, credential exposure, and security best practice violations.
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} color="#6366F1" gutterBottom>
                Code Quality Score
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Assesses code structure, naming conventions, documentation, and adherence to language best practices.
              </Typography>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} color="#10B981" gutterBottom>
                Maintainability Score
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Measures code readability, modularity, error handling, logging, and long-term maintenance ease.
              </Typography>
            </Paper>
          </Box>

          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Score Deductions:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Critical issues: -25 points per issue</li>
              <li>High severity: -15 points per issue</li>
              <li>Medium severity: -10 points per issue</li>
              <li>Low severity: -5 points per issue</li>
            </ul>
          </Alert>
        </Box>

        {/* Best Practices */}
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ color: '#10B981' }} />
            Best Practices
          </Typography>

          <Box component="ul" sx={{ pl: 3 }}>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Start with lenient thresholds (60-70)</strong> - Gradually increase as code quality improves
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Always enable --fail-on-critical</strong> - Never allow critical security or logic issues
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Review changed files only</strong> - Focus on PR diffs rather than entire codebase
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Cache dependencies</strong> - Speed up CI runs by caching node_modules
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Post results as comments</strong> - Provide visibility to developers in PR reviews
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Use SARIF format</strong> - Enable GitHub Code Scanning integration for better visibility
              </Typography>
            </li>
            <li>
              <Typography variant="body2" paragraph>
                <strong>Set up quality gates per environment</strong> - Stricter rules for production, lenient for development
              </Typography>
            </li>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
