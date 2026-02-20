import { Box, Paper, Typography, Divider, Chip } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StorageIcon from '@mui/icons-material/Storage';
import WebIcon from '@mui/icons-material/Web';
import CloudIcon from '@mui/icons-material/Cloud';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';

export default function ArchitecturePage() {
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
          <AccountTreeIcon sx={{ fontSize: 32, color: '#6366F1' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              System Architecture
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Overview of the Code Review Assistant architecture and components
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Architecture Overview */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Architecture Overview
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            The Code Review Assistant is built as a full-stack TypeScript application with a React frontend,
            Express backend, and AI-powered analysis engine. It supports multiple deployment modes: web application,
            CLI tool, VSCode extension, and CI/CD integration.
          </Typography>
        </Box>

        {/* Component Diagram */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            System Components
          </Typography>
          
          {/* Frontend Layer */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 2,
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(236, 72, 153, 0.05)' : 'rgba(236, 72, 153, 0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <WebIcon sx={{ color: '#EC4899' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Frontend Layer (React + TypeScript)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Built with React 18, Material-UI (MUI), and TypeScript. Provides an interactive web interface
              for code analysis and configuration.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="React 18" size="small" />
              <Chip label="Material-UI" size="small" />
              <Chip label="Vite" size="small" />
              <Chip label="TypeScript" size="small" />
              <Chip label="Prism Syntax Highlighter" size="small" />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Key Features:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'text.secondary' }}>
                <li><Typography variant="body2">Real-time code editor with syntax highlighting</Typography></li>
                <li><Typography variant="body2">Multi-tab results view (Overview, Issues, Refactored Code, Recommendations)</Typography></li>
                <li><Typography variant="body2">Rule configuration interface</Typography></li>
                <li><Typography variant="body2">Custom LLM configuration with OAuth flow</Typography></li>
                <li><Typography variant="body2">Token usage tracking and statistics</Typography></li>
                <li><Typography variant="body2">Dark/Light theme support</Typography></li>
              </ul>
            </Box>
          </Paper>

          {/* Backend Layer */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 2,
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <StorageIcon sx={{ color: '#6366F1' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                Backend Layer (Express + Node.js)
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              RESTful API server built with Express.js, providing endpoints for code analysis, AI integration,
              and configuration management.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="Express.js" size="small" />
              <Chip label="Node.js" size="small" />
              <Chip label="TypeScript" size="small" />
              <Chip label="dotenv" size="small" />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                API Endpoints:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'text.secondary' }}>
                <li><Typography variant="body2" fontFamily="monospace">/api/analyze-code</Typography> - Code analysis with AI and pattern matching</li>
                <li><Typography variant="body2" fontFamily="monospace">/api/ai/config</Typography> - AI configuration status</li>
                <li><Typography variant="body2" fontFamily="monospace">/api/ai-platform/*</Typography> - Custom LLM integration endpoints</li>
                <li><Typography variant="body2" fontFamily="monospace">/api/health</Typography> - Health check endpoint</li>
                <li><Typography variant="body2" fontFamily="monospace">/api/batch-review</Typography> - Batch file analysis for CI/CD</li>
              </ul>
            </Box>
          </Paper>

          {/* AI Engine Layer */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 2,
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.05)' : 'rgba(139, 92, 246, 0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <CloudIcon sx={{ color: '#8B5CF6' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                AI Analysis Engine
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Dual-layer analysis system combining pattern-based rules with AI-powered deep analysis.
              Supports Claude AI (Anthropic) and custom LLM providers via OAuth 2.0.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="Anthropic Claude Sonnet 4" size="small" />
              <Chip label="OpenAI-Compatible APIs" size="small" />
              <Chip label="Pattern Rules Engine" size="small" />
              <Chip label="OAuth 2.0" size="small" />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Analysis Workflow:
              </Typography>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'text.secondary' }}>
                <li><Typography variant="body2">Pattern-based validation (regex rules, best practices)</Typography></li>
                <li><Typography variant="body2">AI semantic analysis (Claude or custom LLM)</Typography></li>
                <li><Typography variant="body2">Issue deduplication and merging</Typography></li>
                <li><Typography variant="body2">Score calculation (performance, security, quality, maintainability)</Typography></li>
                <li><Typography variant="body2">Generate recommendations and refactored code</Typography></li>
              </ol>
            </Box>
          </Paper>

          {/* CLI & Integration Layer */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.02)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <IntegrationInstructionsIcon sx={{ color: '#10B981' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                CLI & Integration Layer
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              Command-line interface and VSCode extension for seamless integration into developer workflows
              and CI/CD pipelines.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip label="Node.js CLI" size="small" />
              <Chip label="VSCode Extension" size="small" />
              <Chip label="SARIF Output" size="small" />
              <Chip label="GitHub Actions" size="small" />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600} gutterBottom>
                Integration Points:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'text.secondary' }}>
                <li><Typography variant="body2">CI/CD script with threshold-based gating</Typography></li>
                <li><Typography variant="body2">VSCode extension with inline diagnostics</Typography></li>
                <li><Typography variant="body2">SARIF output for GitHub Code Scanning</Typography></li>
                <li><Typography variant="body2">JSON/Markdown reports for documentation</Typography></li>
              </ul>
            </Box>
          </Paper>
        </Box>

        {/* Data Flow */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Data Flow
          </Typography>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            }}
          >
            <Typography variant="body2" fontFamily="monospace" sx={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>
{`1. User Input (Code + Language)
   ↓
2. Frontend Validation
   ↓
3. API Request to Backend (/api/analyze-code)
   ↓
4. Pattern Rules Engine (Local Analysis)
   ↓
5. AI Provider Selection (Claude or Custom LLM)
   ↓
6. OAuth Token Acquisition (if using custom LLM)
   ↓
7. AI API Call (with prompt engineering)
   ↓
8. Response Parsing & Issue Extraction
   ↓
9. Issue Merging & Deduplication
   ↓
10. Score Calculation & Recommendations
    ↓
11. Response to Frontend
    ↓
12. Results Rendering (Tabs: Overview, Issues, Refactored Code)`}
            </Typography>
          </Paper>
        </Box>

        {/* Supported Languages */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Supported Languages & Frameworks
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip label="Python" color="primary" variant="outlined" />
            <Chip label="PySpark" color="primary" variant="outlined" />
            <Chip label="Scala" color="primary" variant="outlined" />
            <Chip label="SQL" color="primary" variant="outlined" />
            <Chip label="Terraform" color="primary" variant="outlined" />
          </Box>
        </Box>

        {/* Technology Stack */}
        <Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Technology Stack
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Frontend
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                • React 18<br />
                • TypeScript<br />
                • Material-UI<br />
                • Vite<br />
                • Prism
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Backend
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                • Node.js<br />
                • Express.js<br />
                • TypeScript<br />
                • dotenv
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                AI/ML
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                • Anthropic SDK<br />
                • Claude Sonnet 4<br />
                • OAuth 2.0<br />
                • Pattern Matching
              </Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                DevTools
              </Typography>
              <Typography variant="body2" color="text.secondary" component="div">
                • VSCode API<br />
                • GitHub Actions<br />
                • SARIF Format<br />
                • CLI Tools
              </Typography>
            </Paper>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
