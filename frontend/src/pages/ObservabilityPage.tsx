import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  TablePagination,
  Tabs,
  Tab,
  Drawer,
  CircularProgress,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InsightsIcon from '@mui/icons-material/Insights';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TokenIcon from '@mui/icons-material/Toll';
import SpeedIcon from '@mui/icons-material/Speed';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FolderIcon from '@mui/icons-material/Folder';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';
import ExtensionIcon from '@mui/icons-material/Extension';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AppsIcon from '@mui/icons-material/Apps';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ArticleIcon from '@mui/icons-material/Article';
import type { MetricsSummary } from '../types';
import {
  fetchMetricsSummary,
  fetchMetricsProjects,
  fetchRunDetails,
  fetchRunDetail,
} from '../services/api';

// ── Local types for run-details (drill-down) ──

interface ValidationFailure {
  rule_id?: string;
  rule?: string;
  message: string;
  severity?: string;
  file?: string;
  line?: number;
  category?: string;
  suggestion?: string;
}

interface LLMFinding {
  severity?: string;
  category?: string;
  message: string;
  line_number?: number;
  suggestion?: string;
  file?: string;
  reasoning?: string;
  codeSnippet?: string;
}

interface PerFileIssue {
  severity?: string;
  category?: string;
  message: string;
  suggestion?: string;
  line_number?: number;
}

interface PerFileResult {
  file: string;
  issues?: PerFileIssue[] | number;
  validation_count?: number;
  llm_count?: number;
  status?: string;
  language?: string;
}

interface RunDetailSummary {
  id: number;
  run_id: string;
  repository: string;
  project_id?: string;
  pr_number?: number;
  commit_sha?: string;
  actor?: string;
  branch?: string;
  workflow_run_id: string;
  gate_status: string;
  status: string;
  severity_distribution: Record<string, number>;
  total_issues: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  files_reviewed: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  model?: string;
  latency_ms: number;
  timestamp: string;
  runtime_ms: number;
  validation_failure_count: number;
  llm_finding_count: number;
  source: string;
}

interface RunDetailFull extends RunDetailSummary {
  validation_failures: ValidationFailure[];
  llm_findings: LLMFinding[];
  per_file_results: PerFileResult[];
}

// ── Severity helpers ──

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#3B82F6',
  info: '#6B7280',
};

function SeverityChip({ severity }: { severity?: string }) {
  const s = (severity || 'info').toLowerCase();
  const color = SEVERITY_COLORS[s] || '#6B7280';
  return (
    <Chip
      label={s.toUpperCase()}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.65rem',
        fontWeight: 700,
        color,
        borderColor: color,
        bgcolor: `${color}18`,
      }}
      variant="outlined"
    />
  );
}

// ── Summary Card ──

function SummaryCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: `${color}18`,
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={700} noWrap>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

// ── Status / Gate Chips ──

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { color: 'success' | 'error' | 'warning'; label: string }> = {
    success: { color: 'success', label: 'Success' },
    failure: { color: 'error', label: 'Failed' },
    partial: { color: 'warning', label: 'Partial' },
  };
  const { color, label } = config[status] || { color: 'warning' as const, label: status };
  return <Chip label={label} color={color} size="small" variant="outlined" />;
}

function GateChip({ gate }: { gate: string }) {
  return (
    <Chip
      label={gate === 'pass' ? 'GATE PASS' : 'GATE FAIL'}
      size="small"
      color={gate === 'pass' ? 'success' : 'error'}
      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
    />
  );
}

// ── Token Bar ──

function TokenBar({ input, output }: { input: number; output: number }) {
  const total = input + output;
  if (total === 0) return <Typography variant="caption" color="text.secondary">-</Typography>;
  const inputPct = (input / total) * 100;
  return (
    <Tooltip title={`Input: ${input.toLocaleString()} | Output: ${output.toLocaleString()}`}>
      <Box sx={{ width: 120 }}>
        <Typography variant="caption" fontWeight={600}>
          {total.toLocaleString()}
        </Typography>
        <Box sx={{ display: 'flex', height: 4, borderRadius: 1, overflow: 'hidden', mt: 0.5 }}>
          <Box sx={{ width: `${inputPct}%`, bgcolor: '#6366F1' }} />
          <Box sx={{ flex: 1, bgcolor: '#EC4899' }} />
        </Box>
      </Box>
    </Tooltip>
  );
}

// ── Drill-Down Drawer ──

function DrillDownDrawer({
  runId,
  open,
  onClose,
}: {
  runId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<RunDetailFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !runId) return;
    setDetail(null);
    setError(null);
    setLoading(true);
    fetchRunDetail(runId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, runId]);

  const sourceLabel: Record<string, string> = {
    ide: 'IDE Extension',
    pipeline: 'CI/CD Pipeline',
    application: 'Application',
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100vw', md: 760 }, p: 0 } }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={700}>
            Run Detail
          </Typography>
          {detail && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {detail.run_id}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ p: 3, overflowY: 'auto', height: 'calc(100% - 65px)' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {detail && !loading && (
          <Stack spacing={3}>
            {/* Metadata */}
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 1.5,
                }}
              >
                {[
                  ['Repository', detail.repository],
                  ...(detail.source === 'pipeline' ? [
                    ['Branch', detail.branch || '-'],
                    ['PR', detail.pr_number ? `#${detail.pr_number}` : '-'],
                    ['Commit', detail.commit_sha ? detail.commit_sha.slice(0, 8) : '-'],
                  ] : []),
                  ['User / Actor', detail.actor || '-'],
                  ['Model', detail.model || '-'],
                  ['Files Reviewed', String(detail.files_reviewed)],
                  ['Latency', detail.latency_ms > 0 ? `${(detail.latency_ms / 1000).toFixed(1)}s` : '-'],
                  ['Tokens', detail.total_tokens.toLocaleString()],
                  ['Cost', detail.cost_usd > 0 ? `$${detail.cost_usd.toFixed(6)}` : '-'],
                  ['Timestamp', new Date(detail.timestamp).toLocaleString()],
                  ['Source', sourceLabel[detail.source] || detail.source],
                ].map(([k, v]) => (
                  <Box key={k}>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {k}
                    </Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ fontFamily: k === 'Commit' ? 'monospace' : undefined }}>
                      {v}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <StatusChip status={detail.status} />
                {detail.source === 'pipeline' && <GateChip gate={detail.gate_status} />}
                {detail.source && (
                  <Chip
                    label={sourceLabel[detail.source] || detail.source}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Box>
            </Paper>

            {/* Severity Distribution */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Severity Distribution
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Object.entries({
                  critical: detail.critical_count,
                  high: detail.high_count,
                  medium: detail.medium_count,
                  low: detail.low_count,
                }).map(([sev, count]) => (
                  <Paper
                    key={sev}
                    elevation={0}
                    sx={{
                      px: 2,
                      py: 1,
                      border: 1,
                      borderColor: `${SEVERITY_COLORS[sev]}44`,
                      bgcolor: `${SEVERITY_COLORS[sev]}0D`,
                      textAlign: 'center',
                      minWidth: 72,
                    }}
                  >
                    <Typography
                      variant="h6"
                      fontWeight={700}
                      sx={{ color: SEVERITY_COLORS[sev] }}
                    >
                      {count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {sev}
                    </Typography>
                  </Paper>
                ))}
                <Paper
                  elevation={0}
                  sx={{ px: 2, py: 1, border: 1, borderColor: 'divider', textAlign: 'center', minWidth: 72 }}
                >
                  <Typography variant="h6" fontWeight={700}>{detail.total_issues}</Typography>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                </Paper>
              </Box>
            </Box>

            {/* Validation Failures */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WarningAmberIcon sx={{ color: '#F59E0B', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  Validation Failures
                </Typography>
                <Badge badgeContent={detail.validation_failures.length} color="warning" max={999} />
              </Box>
              {detail.validation_failures.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No validation failures recorded.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {detail.validation_failures.map((vf, i) => (
                    <Paper
                      key={i}
                      elevation={0}
                      sx={{ p: 1.5, border: 1, borderColor: 'divider', borderLeft: 3, borderLeftColor: SEVERITY_COLORS[vf.severity?.toLowerCase() || 'info'] || '#6B7280' }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <SeverityChip severity={vf.severity} />
                        {vf.category && (
                          <Chip label={vf.category} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                        {vf.rule_id && (
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                            {vf.rule_id}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {vf.message}
                      </Typography>
                      {vf.file && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                          {vf.file}{vf.line != null ? `:${vf.line}` : ''}
                        </Typography>
                      )}
                      {vf.suggestion && (
                        <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                          Suggestion: {vf.suggestion}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>

            {/* LLM Findings */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PsychologyIcon sx={{ color: '#6366F1', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  LLM Findings
                </Typography>
                <Badge badgeContent={detail.llm_findings.length} color="primary" max={999} />
              </Box>
              {detail.llm_findings.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No LLM findings recorded.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {detail.llm_findings.map((f, i) => (
                    <Accordion key={i} elevation={0} sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                          <SeverityChip severity={f.severity} />
                          {f.category && (
                            <Chip label={f.category} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                            {f.message}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        {f.file && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block', mb: 0.5 }}>
                            {f.file}{f.line_number != null ? `:${f.line_number}` : ''}
                          </Typography>
                        )}
                        {f.suggestion && (
                          <Typography variant="body2" color="primary" sx={{ mb: 0.5 }}>
                            Suggestion: {f.suggestion}
                          </Typography>
                        )}
                        {f.reasoning && (
                          <Box sx={{ mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="caption" color="text.secondary" fontStyle="italic">
                              {f.reasoning}
                            </Typography>
                          </Box>
                        )}
                        {f.codeSnippet && (
                          <Box
                            component="pre"
                            sx={{
                              mt: 1,
                              p: 1,
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                              borderRadius: 1,
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {f.codeSnippet}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Stack>
              )}
            </Box>

            {/* Per-File Results */}
            {detail.per_file_results && detail.per_file_results.length > 0 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ArticleIcon sx={{ color: '#10B981', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight={700}>
                    Issues by File
                  </Typography>
                </Box>
                <Stack spacing={1}>
                  {detail.per_file_results.map((pf, i) => {
                    const issueList: PerFileIssue[] = Array.isArray(pf.issues) ? pf.issues : [];
                    const issueCount = issueList.length || (typeof pf.issues === 'number' ? pf.issues : 0);
                    return (
                      <Accordion key={i} elevation={0} defaultExpanded={issueList.length > 0} sx={{ border: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                            <ArticleIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, mr: 1 }} noWrap>
                              {pf.file}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                              {pf.language && (
                                <Chip label={pf.language} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                              )}
                              <Chip
                                label={`${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
                                size="small"
                                color={issueCount > 0 ? 'warning' : 'success'}
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                              {pf.validation_count != null && (
                                <Chip label={`${pf.validation_count} rule`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                              )}
                              {pf.llm_count != null && (
                                <Chip label={`${pf.llm_count} AI`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', color: '#6366F1', borderColor: '#6366F1' }} />
                              )}
                            </Box>
                          </Box>
                        </AccordionSummary>
                        {issueList.length > 0 && (
                          <AccordionDetails sx={{ pt: 0, px: 1.5, pb: 1.5 }}>
                            <Stack spacing={0.75}>
                              {issueList.map((issue, j) => (
                                <Paper
                                  key={j}
                                  elevation={0}
                                  sx={{
                                    p: 1.5,
                                    border: 1,
                                    borderColor: 'divider',
                                    borderLeft: 3,
                                    borderLeftColor: SEVERITY_COLORS[(issue.severity || 'info').toLowerCase()] || '#6B7280',
                                  }}
                                >
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <SeverityChip severity={issue.severity} />
                                    {issue.category && (
                                      <Chip label={issue.category} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                    )}
                                    {issue.line_number != null && (
                                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                        line {issue.line_number}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Typography variant="body2">{issue.message}</Typography>
                                  {issue.suggestion && (
                                    <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>
                                      Suggestion: {issue.suggestion}
                                    </Typography>
                                  )}
                                </Paper>
                              ))}
                            </Stack>
                          </AccordionDetails>
                        )}
                      </Accordion>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

// ── Source Dashboard (one per tab) ──

interface SourceDashboardProps {
  source: 'pipeline' | 'ide' | 'application';
  active: boolean;
}

function SourceDashboard({ source, active }: SourceDashboardProps) {
  const [runs, setRuns] = useState<RunDetailSummary[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [repository, setRepository] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Drill-down
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Projects (for repo dropdown)
  const [projects, setProjects] = useState<{ repository: string }[]>([]);

  const loadData = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const runParams = {
        source,
        repository: repository || undefined,
        status: status || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };

      const summaryParams = {
        source,
        repository: repository || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };

      const [runsRes, summaryRes, projectsRes] = await Promise.all([
        fetchRunDetails(runParams),
        fetchMetricsSummary(summaryParams),
        fetchMetricsProjects(),
      ]);

      setRuns(runsRes.data ?? []);
      setSummary(summaryRes);
      setProjects(projectsRes.data ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [active, source, repository, status, fromDate, toDate, page, rowsPerPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const uniqueRepos = [...new Set(projects.map((p) => p.repository))];

  function openDrillDown(runId: string) {
    setSelectedRunId(runId);
    setDrawerOpen(true);
  }

  return (
    <Box>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary Cards */}
      {summary && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          <SummaryCard
            label="Total Runs"
            value={summary.total_runs}
            subtitle={`${summary.repositories} repo(s) / ${summary.projects} project(s)`}
            icon={<FolderIcon />}
            color="#6366F1"
          />
          <SummaryCard
            label="Success Rate"
            value={`${summary.success_rate}%`}
            subtitle={`${summary.success_count} passed / ${summary.failure_count} failed`}
            icon={<CheckCircleIcon />}
            color={summary.success_rate >= 80 ? '#10B981' : '#EF4444'}
          />
          <SummaryCard
            label="Total Tokens"
            value={summary.total_tokens_consumed.toLocaleString()}
            subtitle={`~${summary.avg_tokens_per_run.toLocaleString()} per run`}
            icon={<TokenIcon />}
            color="#F59E0B"
          />
          <SummaryCard
            label="Total Cost"
            value={`$${summary.total_cost_usd.toFixed(4)}`}
            subtitle={`~$${summary.avg_cost_per_run.toFixed(4)} per run`}
            icon={<AttachMoneyIcon />}
            color="#10B981"
          />
          <SummaryCard
            label="Avg Latency"
            value={`${(summary.avg_latency_ms / 1000).toFixed(1)}s`}
            subtitle={`${summary.total_issues_found} issues / ${summary.total_critical} critical`}
            icon={<SpeedIcon />}
            color="#EC4899"
          />
        </Box>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Repository</InputLabel>
            <Select value={repository} label="Repository" onChange={(e) => { setRepository(e.target.value); setPage(0); }}>
              <MenuItem value="">All</MenuItem>
              {uniqueRepos.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failure">Failure</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="From"
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <TextField
            size="small"
            label="To"
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />

          <Tooltip title="Refresh">
            <IconButton onClick={loadData} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Runs Table */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Repository</TableCell>
                {source === 'pipeline' && <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>}
                {source === 'pipeline' && <TableCell sx={{ fontWeight: 700 }}>PR</TableCell>}
                <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Run ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                {source === 'pipeline' && <TableCell sx={{ fontWeight: 700 }}>Gate</TableCell>}
                <TableCell sx={{ fontWeight: 700 }}>Files</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Issues</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tokens</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cost</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Latency</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={source === 'pipeline' ? 14 : 11} align="center" sx={{ py: 6 }}>
                    <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary">
                      No runs recorded for this source yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((m) => (
                  <TableRow key={m.id} hover sx={{ cursor: 'pointer' }} onClick={() => openDrillDown(m.run_id)}>
                    <TableCell>
                      <Tooltip title={m.timestamp}>
                        <Typography variant="body2" fontSize="0.8rem">
                          {new Date(m.timestamp).toLocaleString()}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem" fontWeight={500}>
                        {m.repository}
                      </Typography>
                    </TableCell>
                    {source === 'pipeline' && (
                      <TableCell>
                        <Typography variant="body2" fontSize="0.8rem">
                          {m.branch || '-'}
                        </Typography>
                      </TableCell>
                    )}
                    {source === 'pipeline' && (
                      <TableCell>
                        <Typography variant="body2" fontSize="0.8rem">
                          {m.pr_number ? `#${m.pr_number}` : '-'}
                        </Typography>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem">
                        {m.actor || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Click to open drill-down">
                        <Typography
                          variant="body2"
                          fontSize="0.8rem"
                          sx={{
                            fontFamily: 'monospace',
                            color: 'primary.main',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => { e.stopPropagation(); openDrillDown(m.run_id); }}
                        >
                          {m.workflow_run_id.length > 12
                            ? `${m.workflow_run_id.slice(0, 12)}…`
                            : m.workflow_run_id}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={m.status} />
                    </TableCell>
                    {source === 'pipeline' && (
                      <TableCell>
                        <GateChip gate={m.gate_status} />
                      </TableCell>
                    )}
                    <TableCell align="center">{m.files_reviewed}</TableCell>
                    <TableCell>
                      <Tooltip title="Click to view full drill-down">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography
                            variant="body2"
                            fontSize="0.8rem"
                            sx={{
                              fontWeight: 700,
                              color: m.total_issues > 0 ? '#F97316' : 'text.primary',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                          >
                            {m.total_issues}
                          </Typography>
                          {m.critical_count > 0 && (
                            <Chip label={`${m.critical_count}C`} size="small" color="error" sx={{ height: 18, fontSize: '0.7rem' }} />
                          )}
                          {m.high_count > 0 && (
                            <Chip label={`${m.high_count}H`} size="small" color="warning" sx={{ height: 18, fontSize: '0.7rem' }} />
                          )}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <TokenBar input={m.input_tokens} output={m.output_tokens} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem" fontWeight={500} color={m.cost_usd > 0 ? '#10B981' : 'text.secondary'}>
                        {m.cost_usd > 0 ? `$${m.cost_usd.toFixed(4)}` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem">
                        {m.latency_ms > 0 ? `${(m.latency_ms / 1000).toFixed(1)}s` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.75rem" sx={{ fontFamily: 'monospace' }}>
                        {m.model || '-'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={-1}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelDisplayedRows={({ from, to }) => `${from}-${to}`}
        />
      </Paper>

      <DrillDownDrawer
        runId={selectedRunId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Box>
  );
}

// ── Tab panel helper ──

interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
      {value === index && children}
    </Box>
  );
}

// ── Main Page ──

export default function ObservabilityPage() {
  const [tab, setTab] = useState(0);

  const tabs: { label: string; source: 'pipeline' | 'ide' | 'application'; icon: React.ReactNode; description: string }[] = [
    {
      label: 'Pipeline',
      source: 'pipeline',
      icon: <AccountTreeIcon fontSize="small" />,
      description: 'GitHub Actions / CI-CD workflow reviews',
    },
    {
      label: 'IDE Extension',
      source: 'ide',
      icon: <ExtensionIcon fontSize="small" />,
      description: 'VS Code extension inline reviews',
    },
    {
      label: 'Application',
      source: 'application',
      icon: <AppsIcon fontSize="small" />,
      description: 'Direct API / application-triggered reviews',
    },
  ];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <InsightsIcon sx={{ fontSize: 32, color: '#F59E0B' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Agent Observability
          </Typography>
          <Typography variant="body2" color="text.secondary">
            API token usage, latency, and review metrics — segmented by source
          </Typography>
        </Box>
      </Box>

      {/* Source tabs */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          {tabs.map((t, i) => (
            <Tab
              key={t.source}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {t.icon}
                  <span>{t.label}</span>
                </Box>
              }
              id={`obs-tab-${i}`}
              aria-controls={`obs-tabpanel-${i}`}
            />
          ))}
        </Tabs>

        <Box sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
          {tabs.map((t, i) => (
            <TabPanel key={t.source} value={tab} index={i}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {t.description}
                </Typography>
              </Box>
              <SourceDashboard source={t.source} active={tab === i} />
            </TabPanel>
          ))}
        </Box>
      </Paper>

      {/* IDE Integration Guide */}
      {tab === 1 && (
        <>
          <Divider sx={{ my: 4 }} />
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(99, 102, 241, 0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <ExtensionIcon sx={{ color: '#6366F1' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                VS Code Extension Setup
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              To send reviews from VS Code with <code>source=ide</code>, add a request body field
              when calling the review endpoint:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5'),
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
              }}
            >
{`// VS Code extension — send review with source tag
fetch('https://your-api/api/analyze-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: selectedText,
    language: detectedLanguage,
    source: 'ide',           // ← tags this run for the IDE dashboard
  }),
});`}
            </Box>
          </Paper>
        </>
      )}

      {/* Pipeline Integration Guide */}
      {tab === 0 && (
        <>
          <Divider sx={{ my: 4 }} />
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(99, 102, 241, 0.04)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AccountTreeIcon sx={{ color: '#6366F1' }} />
              <Typography variant="subtitle1" fontWeight={700}>
                GitHub Actions Integration
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" paragraph>
              The reusable workflow automatically posts metrics with <code>source: "pipeline"</code>.
              Add this to your caller workflow:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5'),
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
              }}
            >
{`# .github/workflows/caller.yml
jobs:
  code-review:
    uses: nikhilchatta/AI-CodeReview-Assistant/.github/workflows/ai-code-review.yml@main
    secrets:
      ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
      CODE_REVIEW_API_URL: \${{ secrets.CODE_REVIEW_API_URL }}
    with:
      project_id: \${{ github.event.repository.name }}`}
            </Box>
          </Paper>
        </>
      )}
    </Box>
  );
}
