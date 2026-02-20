import { Box, Paper, Typography, Divider, Alert, Chip, Tabs, Tab } from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import BusinessIcon from '@mui/icons-material/Business';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useState } from 'react';

export default function EnterpriseCredentialsPage() {
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
          <SecurityIcon sx={{ fontSize: 32, color: '#EF4444' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Managing Credentials at Scale
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Deploy code review gates across hundreds or thousands of pipelines
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Overview */}
        <Alert severity="success" sx={{ mb: 4 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Good News: You only need ONE set of credentials for ALL pipelines
          </Typography>
          <Typography variant="body2">
            Use organization-level or group-level secrets to share credentials across all repositories.
            No need to configure each pipeline individually.
          </Typography>
        </Alert>

        {/* Tabs for different platforms */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="GitHub Enterprise" />
          <Tab label="GitLab Groups" />
          <Tab label="Azure DevOps" />
          <Tab label="Jenkins" />
        </Tabs>

        {/* GitHub Enterprise */}
        {activeTab === 0 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BusinessIcon /> GitHub Organization Secrets
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              GitHub Organizations allow you to create secrets once and share them across ALL repositories.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Step 1: Create Organization-Level Secret
              </Typography>
              <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
                <li><Typography variant="body2">Go to your GitHub Organization settings</Typography></li>
                <li><Typography variant="body2">Navigate to <strong>Settings → Secrets and variables → Actions</strong></Typography></li>
                <li><Typography variant="body2">Click <strong>New organization secret</strong></Typography></li>
                <li>
                  <Typography variant="body2">Add the secret:</Typography>
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Typography variant="body2" fontFamily="monospace">Name: <strong>ANTHROPIC_API_KEY</strong></Typography>
                    <Typography variant="body2" fontFamily="monospace">Value: sk-ant-your-api-key-here</Typography>
                  </Box>
                </li>
                <li>
                  <Typography variant="body2">
                    <strong>Repository access:</strong> Select "All repositories" or choose specific repos
                  </Typography>
                </li>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                For custom LLM with OAuth: Create additional secrets:
                <Box sx={{ mt: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  • AI_PLATFORM_BASE_URL<br/>
                  • AI_PLATFORM_TOKEN_URL<br/>
                  • AI_PLATFORM_CLIENT_ID<br/>
                  • AI_PLATFORM_CLIENT_SECRET
                </Box>
              </Alert>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Step 2: Use in ALL Workflows (No Changes Needed)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Once set at organization level, ALL repositories can access the secret automatically:
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
{`# This works in ANY repository in your organization
jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - name: Run Code Review
        env:
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          # Your review command
          npx tsx scripts/ci-review.ts --threshold 75 --fail-on-critical`}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(16, 185, 129, 0.05)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom color="#10B981">
                ✅ Benefit: Zero Per-Repository Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add the workflow file to 1000 repos → All automatically use the same organization secret.
                Update the secret once, affects all repos instantly.
              </Typography>
            </Paper>
          </Box>
        )}

        {/* GitLab Groups */}
        {activeTab === 1 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              GitLab Group-Level Variables
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              GitLab Groups allow you to define CI/CD variables once for all projects in the group and subgroups.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Step 1: Create Group-Level CI/CD Variables
              </Typography>
              <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
                <li><Typography variant="body2">Navigate to your GitLab Group (top-level or sub-group)</Typography></li>
                <li><Typography variant="body2">Go to <strong>Settings → CI/CD → Variables</strong></Typography></li>
                <li><Typography variant="body2">Click <strong>Add variable</strong></Typography></li>
                <li>
                  <Typography variant="body2">Configure the variable:</Typography>
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Typography variant="body2" fontFamily="monospace">Key: <strong>ANTHROPIC_API_KEY</strong></Typography>
                    <Typography variant="body2" fontFamily="monospace">Value: sk-ant-your-api-key-here</Typography>
                    <Typography variant="body2">Type: Variable</Typography>
                    <Typography variant="body2">✓ Protect variable (recommended)</Typography>
                    <Typography variant="body2">✓ Mask variable (recommended)</Typography>
                  </Box>
                </li>
              </Box>

              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2" fontWeight={600}>
                  Inheritance Scope:
                </Typography>
                <Typography variant="body2">
                  Group variables are inherited by ALL projects and subgroups. Set it at the parent group level
                  to cover your entire organization.
                </Typography>
              </Alert>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Step 2: Use Across All Projects
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
{`# .gitlab-ci.yml (same for all 1000 projects)
code_review_gate:
  stage: review
  script:
    - npx tsx scripts/ci-review.ts --threshold 75 --fail-on-critical
  variables:
    # Automatically inherited from group
    CODE_REVIEW_API_URL: "http://localhost:5001/api"
    # ANTHROPIC_API_KEY is inherited automatically
  only:
    - merge_requests`}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                For Custom LLM OAuth Credentials
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add these additional group variables once:
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', '& div': { mb: 0.5 } }}>
                <div>AI_PLATFORM_BASE_URL = https://api.your-llm.com</div>
                <div>AI_PLATFORM_TOKEN_URL = https://auth.your-llm.com/oauth2/token</div>
                <div>AI_PLATFORM_CLIENT_ID = your-client-id</div>
                <div>AI_PLATFORM_CLIENT_SECRET = your-client-secret (masked)</div>
              </Box>
            </Paper>
          </Box>
        )}

        {/* Azure DevOps */}
        {activeTab === 2 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Azure DevOps Service Connections & Variable Groups
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              Azure DevOps offers two approaches: Variable Groups (organization-wide) or Library Variable Groups.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Option 1: Organization Variable Group (Recommended)
              </Typography>
              <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
                <li><Typography variant="body2">Go to <strong>Pipelines → Library → + Variable group</strong></Typography></li>
                <li><Typography variant="body2">Name: <code>code-review-secrets</code></Typography></li>
                <li>
                  <Typography variant="body2">Add variables:</Typography>
                  <Box sx={{ ml: 2, mt: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    ANTHROPIC_API_KEY = sk-ant-... (🔒 locked)<br/>
                    CODE_REVIEW_API_URL = http://localhost:5001/api
                  </Box>
                </li>
                <li><Typography variant="body2">Under <strong>Pipeline permissions</strong>, grant access to all pipelines</Typography></li>
              </Box>

              <Box
                component="pre"
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                }}
              >
{`# azure-pipelines.yml (all pipelines)
variables:
  - group: code-review-secrets  # Links to the variable group

stages:
  - stage: CodeReview
    jobs:
      - job: Review
        steps:
          - script: |
              npx tsx scripts/ci-review.ts --threshold 75 --fail-on-critical
            env:
              ANTHROPIC_API_KEY: $(ANTHROPIC_API_KEY)
              CODE_REVIEW_API_URL: $(CODE_REVIEW_API_URL)`}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Option 2: Azure Key Vault Integration (Enterprise)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                For enhanced security, store secrets in Azure Key Vault and link to pipelines:
              </Typography>
              <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
                <li><Typography variant="body2">Create an Azure Key Vault</Typography></li>
                <li><Typography variant="body2">Add secret: <code>anthropic-api-key</code></Typography></li>
                <li><Typography variant="body2">Create Service Connection to Key Vault in Azure DevOps</Typography></li>
                <li><Typography variant="body2">Create Variable Group linked to Key Vault</Typography></li>
                <li><Typography variant="body2">All pipelines reference the variable group</Typography></li>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Benefit: Secrets never exposed in Azure DevOps. Centralized rotation and audit logs.
              </Typography>
            </Paper>
          </Box>
        )}

        {/* Jenkins */}
        {activeTab === 3 && (
          <Box>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Jenkins Global Credentials
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              Jenkins offers centralized credential management accessible to all pipelines.
            </Typography>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Step 1: Add Global Credentials
              </Typography>
              <Box component="ol" sx={{ pl: 3, '& li': { mb: 1 } }}>
                <li><Typography variant="body2">Navigate to <strong>Manage Jenkins → Manage Credentials</strong></Typography></li>
                <li><Typography variant="body2">Select <strong>(global)</strong> domain</Typography></li>
                <li><Typography variant="body2">Click <strong>Add Credentials</strong></Typography></li>
                <li>
                  <Typography variant="body2">Configure:</Typography>
                  <Box sx={{ ml: 2, mt: 1 }}>
                    <Typography variant="body2">Kind: Secret text</Typography>
                    <Typography variant="body2">Scope: Global</Typography>
                    <Typography variant="body2" fontFamily="monospace">ID: <strong>anthropic-api-key</strong></Typography>
                    <Typography variant="body2">Secret: sk-ant-your-api-key-here</Typography>
                    <Typography variant="body2">Description: Anthropic API Key for Code Review</Typography>
                  </Box>
                </li>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Step 2: Use in Jenkinsfile (All Pipelines)
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
        // Reference global credential
        ANTHROPIC_API_KEY = credentials('anthropic-api-key')
        CODE_REVIEW_API_URL = 'http://localhost:5001/api'
    }
    
    stages {
        stage('Code Review') {
            steps {
                script {
                    sh '''
                        npx tsx scripts/ci-review.ts \\
                          --threshold 75 \\
                          --fail-on-critical
                    '''
                }
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
                expression { currentBuild.result == 'SUCCESS' }
            }
            steps {
                sh './deploy.sh'
            }
        }
    }
}`}
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                For OAuth Credentials (Custom LLM)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Add these as separate Secret Text credentials:
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', '& div': { mb: 0.5 } }}>
                <div>ID: ai-platform-base-url (Secret text)</div>
                <div>ID: ai-platform-token-url (Secret text)</div>
                <div>ID: ai-platform-client-id (Secret text)</div>
                <div>ID: ai-platform-client-secret (Secret text)</div>
              </Box>
            </Paper>
          </Box>
        )}

        <Divider sx={{ my: 4 }} />

        {/* Best Practices */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VpnKeyIcon /> Best Practices for Enterprise Deployment
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, mt: 2 }}>
            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                1. Use Service Accounts (Recommended)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create a dedicated service account API key for CI/CD rather than using personal keys.
                This allows better access control, audit trails, and doesn't break when employees leave.
              </Typography>
              <Box sx={{ mt: 1, p: 2, bgcolor: 'rgba(99, 102, 241, 0.05)', borderRadius: 1 }}>
                <Typography variant="caption" fontWeight={600}>Example:</Typography>
                <Typography variant="body2" fontSize="0.85rem">
                  Anthropic Account: cicd-service@yourcompany.com<br/>
                  API Key: sk-ant-cicd-service-key-...<br/>
                  Purpose: Code Review Automation
                </Typography>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                2. Implement Secret Rotation
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Rotate API keys every 90 days. When using organization/group secrets, you only need to update
                ONE secret and all 1000 pipelines get the new key automatically.
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Chip label="Update Once" size="small" color="success" sx={{ mr: 1 }} />
                <Chip label="Affects All Pipelines" size="small" color="success" />
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                3. Environment-Specific Configurations
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Use different thresholds for different environments:
              </Typography>
              <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', '& div': { mb: 0.5 } }}>
                <div>• Development: --threshold 60 (lenient)</div>
                <div>• Staging: --threshold 70 (moderate)</div>
                <div>• Production: --threshold 80 --fail-on-critical (strict)</div>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                4. Cost Management
              </Typography>
              <Typography variant="body2" color="text.secondary">
                To control API costs across 1000 pipelines:
              </Typography>
              <Box component="ul" sx={{ pl: 3, mt: 1 }}>
                <li><Typography variant="body2">Review only changed files (not entire codebase)</Typography></li>
                <li><Typography variant="body2">Run on PR events only, not every commit</Typography></li>
                <li><Typography variant="body2">Set up rate limiting in the backend</Typography></li>
                <li><Typography variant="body2">Monitor usage via Anthropic dashboard</Typography></li>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                5. Audit & Compliance
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Maintain audit logs:
              </Typography>
              <Box component="ul" sx={{ pl: 3, mt: 1 }}>
                <li><Typography variant="body2">Who created/updated organization secrets</Typography></li>
                <li><Typography variant="body2">Which pipelines are using the review gate</Typography></li>
                <li><Typography variant="body2">Review results and deployment decisions</Typography></li>
                <li><Typography variant="body2">API usage metrics per repository</Typography></li>
              </Box>
            </Paper>
          </Box>
        </Box>

        {/* Deployment Strategy */}
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Deployment Strategy for 1000 Pipelines
          </Typography>

          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              Phased Rollout Approach
            </Typography>
            <Box component="ol" sx={{ pl: 3, '& li': { mb: 2 } }}>
              <li>
                <Typography variant="body2" fontWeight={600}>Phase 1: Setup (1 time)</Typography>
                <Typography variant="body2" color="text.secondary">
                  Create organization/group-level secrets with API credentials
                </Typography>
              </li>
              <li>
                <Typography variant="body2" fontWeight={600}>Phase 2: Pilot (10-20 repos)</Typography>
                <Typography variant="body2" color="text.secondary">
                  Test with non-critical repositories, tune thresholds, gather feedback
                </Typography>
              </li>
              <li>
                <Typography variant="body2" fontWeight={600}>Phase 3: Gradual Rollout (100-500 repos)</Typography>
                <Typography variant="body2" color="text.secondary">
                  Deploy to medium-priority repositories, monitor performance and costs
                </Typography>
              </li>
              <li>
                <Typography variant="body2" fontWeight={600}>Phase 4: Full Deployment (all 1000 repos)</Typography>
                <Typography variant="body2" color="text.secondary">
                  Deploy organization-wide using automated PR or infrastructure-as-code
                </Typography>
              </li>
            </Box>

            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                Automation Tip:
              </Typography>
              <Typography variant="body2">
                Use GitHub CLI (<code>gh</code>) or GitLab API to programmatically add workflow files to all repositories.
                This avoids manual work for 1000 pipelines.
              </Typography>
            </Alert>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}
