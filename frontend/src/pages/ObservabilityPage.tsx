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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InsightsIcon from '@mui/icons-material/Insights';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import TokenIcon from '@mui/icons-material/Toll';
import SpeedIcon from '@mui/icons-material/Speed';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import FolderIcon from '@mui/icons-material/Folder';
import BugReportIcon from '@mui/icons-material/BugReport';
import type { WorkflowMetric, MetricsSummary, ProjectInfo } from '../types';
import { fetchMetrics, fetchMetricsSummary, fetchMetricsProjects } from '../services/api';

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

// ── Status Chip ──

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { color: 'success' | 'error' | 'warning'; label: string }> = {
    success: { color: 'success', label: 'Success' },
    failure: { color: 'error', label: 'Failed' },
    partial: { color: 'warning', label: 'Partial' },
  };
  const { color, label } = config[status] || { color: 'warning' as const, label: status };
  return <Chip label={label} color={color} size="small" variant="outlined" />;
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

// ── Main Page ──

export default function ObservabilityPage() {
  const [metrics, setMetrics] = useState<WorkflowMetric[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [repository, setRepository] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filterParams = {
        repository: repository || undefined,
        project_id: projectId || undefined,
        status: status || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };

      const summaryParams = {
        repository: repository || undefined,
        project_id: projectId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };

      const [metricsRes, summaryRes, projectsRes] = await Promise.all([
        fetchMetrics(filterParams),
        fetchMetricsSummary(summaryParams),
        fetchMetricsProjects(),
      ]);

      setMetrics(metricsRes.data);
      setSummary(summaryRes);
      setProjects(projectsRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [repository, projectId, status, fromDate, toDate, page, rowsPerPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const uniqueRepos = [...new Set(projects.map((p) => p.repository))];
  const uniqueProjects = [...new Set(projects.map((p) => p.project_id))];

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <InsightsIcon sx={{ fontSize: 32, color: '#F59E0B' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Agent Observability
            </Typography>
            <Typography variant="body2" color="text.secondary">
              API token usage, latency, and workflow metrics across all repositories
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={loadData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

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

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Project</InputLabel>
            <Select value={projectId} label="Project" onChange={(e) => { setProjectId(e.target.value); setPage(0); }}>
              <MenuItem value="">All</MenuItem>
              {uniqueProjects.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
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
        </Box>
      </Paper>

      {/* Metrics Table */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Repository</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Run ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Files</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Issues</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Tokens</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Cost</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Latency</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 6 }}>
                    <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">
                      No metrics recorded yet. Run the agent with metric reporting enabled.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((m) => (
                  <TableRow key={m.id} hover>
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
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem">
                        {m.branch || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={m.workflow_run_id}>
                        <Typography variant="body2" fontSize="0.8rem" sx={{ fontFamily: 'monospace' }}>
                          {m.workflow_run_id.length > 12
                            ? `${m.workflow_run_id.slice(0, 12)}...`
                            : m.workflow_run_id}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={m.status} />
                    </TableCell>
                    <TableCell align="center">{m.files_reviewed}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {m.issues_found}
                        {m.critical_count > 0 && (
                          <Chip label={`${m.critical_count}C`} size="small" color="error" sx={{ height: 18, fontSize: '0.7rem' }} />
                        )}
                        {m.high_count > 0 && (
                          <Chip label={`${m.high_count}H`} size="small" color="warning" sx={{ height: 18, fontSize: '0.7rem' }} />
                        )}
                      </Box>
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

      {/* Projects Breakdown */}
      {projects.length > 0 && (
        <>
          <Divider sx={{ my: 4 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Projects
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {projects.map((p) => (
              <Paper
                key={`${p.project_id}-${p.repository}`}
                elevation={0}
                sx={{ p: 2, border: 1, borderColor: 'divider', cursor: 'pointer', '&:hover': { borderColor: '#6366F1' } }}
                onClick={() => {
                  setRepository(p.repository);
                  setProjectId(p.project_id);
                  setPage(0);
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  {p.project_id}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {p.repository}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                  <Chip label={`${p.run_count} runs`} size="small" />
                  <Chip
                    label={`${p.success_rate}% pass`}
                    size="small"
                    color={p.success_rate >= 80 ? 'success' : p.success_rate >= 50 ? 'warning' : 'error'}
                    variant="outlined"
                  />
                  <Chip
                    label={`$${p.total_cost_usd.toFixed(4)}`}
                    size="small"
                    variant="outlined"
                    sx={{ color: '#10B981', borderColor: '#10B981' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Last: {new Date(p.last_run).toLocaleDateString()}
                </Typography>
              </Paper>
            ))}
          </Box>
        </>
      )}

      {/* Integration Guide */}
      <Divider sx={{ my: 4 }} />
      <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider', bgcolor: 'rgba(99, 102, 241, 0.04)' }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Taskflow Integration
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Add the metric reporting step to your GitHub Actions workflow after the code review step:
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
{`- name: Run Code Review
  id: review
  run: |
    npx tsx scripts/ci-review.ts --format json \\
      --output review-output.json src/**/*.py
  continue-on-error: true

- name: Report Metrics
  if: always()
  env:
    METRICS_API_URL: \${{ secrets.CODE_REVIEW_API_URL }}
    METRICS_PROJECT_ID: \${{ github.event.repository.name }}
    PR_NUMBER: \${{ github.event.pull_request.number }}
  run: |
    npx tsx scripts/report-metrics.ts \\
      --result-file review-output.json`}
        </Box>
      </Paper>
    </Box>
  );
}
