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
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  TablePagination,
  Stack,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import SchoolIcon from '@mui/icons-material/School';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GitHubIcon from '@mui/icons-material/GitHub';
import MergeIcon from '@mui/icons-material/CallMerge';
import {
  fetchTrainingStats,
  fetchTrainingRecords,
  fetchTrainingExport,
  type TrainingStats,
  type TrainingRecordSummary,
} from '../services/api';

// ── Small stat card ──

function StatCard({
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
      sx={{ p: 2.5, border: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
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

// ── Label chip ──

const LABEL_CONFIG: Record<string, { color: string; label: string }> = {
  correct:        { color: '#22C55E', label: 'Correct' },
  false_positive: { color: '#EF4444', label: 'False Positive' },
  false_negative: { color: '#F97316', label: 'False Negative' },
  partial:        { color: '#F59E0B', label: 'Partial' },
};

function LabelChip({ label }: { label?: string }) {
  if (!label) return <Chip label="Unlabeled" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem', color: 'text.disabled' }} />;
  const cfg = LABEL_CONFIG[label] || { color: '#6B7280', label };
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.65rem',
        fontWeight: 700,
        color: cfg.color,
        borderColor: cfg.color,
        bgcolor: `${cfg.color}18`,
      }}
      variant="outlined"
    />
  );
}

// ── Gate chip ──

function GateChip({ gate }: { gate: string }) {
  return (
    <Chip
      label={gate === 'pass' ? 'PASS' : 'FAIL'}
      size="small"
      color={gate === 'pass' ? 'success' : 'error'}
      sx={{ fontWeight: 700, fontSize: '0.65rem', height: 18 }}
    />
  );
}

// ── Precision bar ──

function PrecisionBar({ value }: { value?: number }) {
  if (value == null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <Tooltip title={`${pct}%`}>
      <Box sx={{ width: 80 }}>
        <Typography variant="caption" fontWeight={600} sx={{ color }}>
          {pct}%
        </Typography>
        <Box sx={{ height: 4, borderRadius: 1, bgcolor: 'action.hover', mt: 0.25 }}>
          <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 1, bgcolor: color }} />
        </Box>
      </Box>
    </Tooltip>
  );
}

// ── Export helpers ──

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ──

export default function TrainingPage() {
  const [stats, setStats]     = useState<TrainingStats | null>(null);
  const [records, setRecords] = useState<TrainingRecordSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [exporting, setExporting] = useState<'json' | 'jsonl' | null>(null);

  // Filters
  const [repository, setRepository] = useState('');
  const [labeledOnly, setLabeledOnly] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  // Pagination
  const [page, setPage]             = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, recordsRes] = await Promise.all([
        fetchTrainingStats(),
        fetchTrainingRecords({
          repository:  repository  || undefined,
          labeled:     labeledOnly || undefined,
          from:        fromDate    || undefined,
          to:          toDate      || undefined,
          limit:       rowsPerPage,
          offset:      page * rowsPerPage,
        }),
      ]);
      setStats(statsRes);
      setRecords(recordsRes.data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [repository, labeledOnly, fromDate, toDate, page, rowsPerPage]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async (format: 'json' | 'jsonl') => {
    setExporting(format);
    try {
      const data = await fetchTrainingExport({
        format,
        repository:  repository || undefined,
        labeled:     labeledOnly || undefined,
        from:        fromDate   || undefined,
        to:          toDate     || undefined,
      });
      const text   = format === 'jsonl' ? (data as string) : JSON.stringify(data, null, 2);
      const blob   = new Blob([text], { type: format === 'jsonl' ? 'application/x-ndjson' : 'application/json' });
      downloadBlob(blob, `training-export-${Date.now()}.${format}`);
    } catch (e: any) {
      setError(`Export failed: ${e.message}`);
    } finally {
      setExporting(null);
    }
  };

  // Derive unique repos from loaded records for the filter dropdown
  const uniqueRepos = [...new Set(records.map((r) => r.repository))].filter(Boolean);

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SchoolIcon sx={{ fontSize: 32, color: '#8B5CF6' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Training Data
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Human feedback collected on review runs — used to improve model accuracy over time
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={exporting === 'json' ? <CircularProgress size={14} /> : <DownloadIcon />}
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
          >
            Export JSON
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={exporting === 'jsonl' ? <CircularProgress size={14} /> : <DownloadIcon />}
            onClick={() => handleExport('jsonl')}
            disabled={exporting !== null}
          >
            Export JSONL
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={load} disabled={loading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Summary cards */}
      {stats && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
              mb: 3,
            }}
          >
            <StatCard
              label="Total Records"
              value={stats.total_records}
              subtitle={`${stats.labeled_records} labeled`}
              icon={<SchoolIcon />}
              color="#8B5CF6"
            />
            <StatCard
              label="Total Feedback"
              value={stats.total_feedback}
              subtitle={`${stats.feedback_by_action.accept} accept / ${stats.feedback_by_action.reject} reject`}
              icon={<ThumbUpIcon />}
              color="#22C55E"
            />
            <StatCard
              label="Avg Precision"
              value={stats.avg_precision != null ? `${Math.round(stats.avg_precision * 100)}%` : '—'}
              subtitle="across labeled records"
              icon={<CheckCircleIcon />}
              color="#6366F1"
            />
            <StatCard
              label="Avg RL Reward"
              value={stats.avg_rl_reward != null ? stats.avg_rl_reward.toFixed(2) : '—'}
              subtitle="-1.0 (all wrong) to +1.0 (all correct)"
              icon={<ErrorOutlineIcon />}
              color={stats.avg_rl_reward != null && stats.avg_rl_reward >= 0 ? '#10B981' : '#EF4444'}
            />
          </Box>

          {/* Feedback breakdown + Label distribution */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              mb: 3,
            }}
          >
            {/* Feedback channels */}
            <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Feedback by Channel
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {[
                  { key: 'dashboard', icon: <DashboardIcon sx={{ fontSize: 16 }} />, label: 'Dashboard', color: '#6366F1' },
                  { key: 'gh',        icon: <GitHubIcon    sx={{ fontSize: 16 }} />, label: 'GitHub Reaction', color: '#6B7280' },
                  { key: 'pr',        icon: <MergeIcon     sx={{ fontSize: 16 }} />, label: 'PR Review', color: '#10B981' },
                ].map(({ key, icon, label, color }) => {
                  const count = (stats.feedback_by_channel as any)[key] ?? 0;
                  const total = stats.total_feedback || 1;
                  const pct   = Math.round((count / total) * 100);
                  return (
                    <Box key={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color }}>
                          {icon}
                          <Typography variant="body2">{label}</Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600}>
                          {count} <Typography component="span" variant="caption" color="text.secondary">({pct}%)</Typography>
                        </Typography>
                      </Box>
                      <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 1, bgcolor: color }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Feedback by Action
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                <Chip
                  icon={<ThumbUpIcon sx={{ fontSize: 14 }} />}
                  label={`Accept: ${stats.feedback_by_action.accept}`}
                  size="small"
                  sx={{ bgcolor: '#22C55E18', color: '#22C55E', borderColor: '#22C55E44', border: 1 }}
                />
                <Chip
                  icon={<ThumbDownIcon sx={{ fontSize: 14 }} />}
                  label={`Reject: ${stats.feedback_by_action.reject}`}
                  size="small"
                  sx={{ bgcolor: '#EF444418', color: '#EF4444', borderColor: '#EF444444', border: 1 }}
                />
                {stats.feedback_by_action.modify > 0 && (
                  <Chip
                    label={`Modify: ${stats.feedback_by_action.modify}`}
                    size="small"
                    sx={{ bgcolor: '#F59E0B18', color: '#F59E0B', borderColor: '#F59E0B44', border: 1 }}
                  />
                )}
              </Box>
            </Paper>

            {/* Label distribution */}
            <Paper elevation={0} sx={{ p: 2.5, border: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Outcome Label Distribution
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {Object.entries({
                  correct:        { label: 'Correct (all accepted)',    color: '#22C55E' },
                  false_positive: { label: 'False Positive (all rejected)', color: '#EF4444' },
                  false_negative: { label: 'False Negative (modified)', color: '#F97316' },
                  partial:        { label: 'Partial (mixed feedback)',  color: '#F59E0B' },
                }).map(([key, { label, color }]) => {
                  const count = (stats.label_distribution as any)[key] ?? 0;
                  const total = stats.labeled_records || 1;
                  const pct   = Math.round((count / total) * 100);
                  return (
                    <Box key={key}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ color }}>{label}</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {count} <Typography component="span" variant="caption" color="text.secondary">({pct}%)</Typography>
                        </Typography>
                      </Box>
                      <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 1, bgcolor: color }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {stats.avg_precision != null && (
                  <Chip size="small" label={`Avg Precision: ${Math.round(stats.avg_precision * 100)}%`} variant="outlined" />
                )}
                {stats.avg_recall != null && (
                  <Chip size="small" label={`Avg Recall: ${Math.round(stats.avg_recall * 100)}%`} variant="outlined" />
                )}
                {stats.avg_rl_reward != null && (
                  <Chip size="small" label={`Avg RL Reward: ${stats.avg_rl_reward.toFixed(2)}`} variant="outlined" />
                )}
              </Box>
            </Paper>
          </Box>
        </>
      )}

      {/* Filters */}
      <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider', mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Repository</InputLabel>
            <Select value={repository} label="Repository" onChange={(e) => { setRepository(e.target.value); setPage(0); }}>
              <MenuItem value="">All</MenuItem>
              {uniqueRepos.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Labeled</InputLabel>
            <Select
              value={labeledOnly ? 'yes' : 'all'}
              label="Labeled"
              onChange={(e) => { setLabeledOnly(e.target.value === 'yes'); setPage(0); }}
            >
              <MenuItem value="all">All records</MenuItem>
              <MenuItem value="yes">Labeled only</MenuItem>
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

      {/* Records table */}
      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Repository</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Run ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Source</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Gate</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Issues</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Feedback</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Label</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Precision</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>TP / FP / FN</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>RL Reward</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={11} align="center" sx={{ py: 8 }}>
                    <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography color="text.secondary">
                      No training records yet. They are created automatically after each PR review.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem">
                        {new Date(r.created_at).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontSize="0.8rem" fontWeight={500} noWrap sx={{ maxWidth: 160 }}>
                        {r.repository}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={r.run_id}>
                        <Typography variant="body2" fontSize="0.75rem" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {r.run_id.length > 14 ? `${r.run_id.slice(0, 14)}…` : r.run_id}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.source}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <GateChip gate={r.gate_status} />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={600} color={r.total_issues > 0 ? '#F97316' : 'text.primary'}>
                        {r.total_issues}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.feedback_count > 0 ? (
                        <Chip
                          label={r.feedback_count}
                          size="small"
                          color="primary"
                          sx={{ height: 18, fontSize: '0.7rem' }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <LabelChip label={r.supervised_label} />
                    </TableCell>
                    <TableCell>
                      <PrecisionBar value={r.precision_score} />
                    </TableCell>
                    <TableCell>
                      {r.feedback_count > 0 ? (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {r.true_positives ?? 0} / {r.false_positives ?? 0} / {r.false_negatives ?? 0}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.rl_reward != null ? (
                        <Typography
                          variant="body2"
                          fontSize="0.8rem"
                          fontWeight={600}
                          sx={{ color: r.rl_reward >= 0 ? '#22C55E' : '#EF4444' }}
                        >
                          {r.rl_reward >= 0 ? '+' : ''}{r.rl_reward.toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
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
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelDisplayedRows={({ from, to }) => `${from}-${to}`}
        />
      </Paper>

      {/* Info box */}
      <Paper elevation={0} sx={{ mt: 3, p: 2.5, border: 1, borderColor: 'divider', bgcolor: 'rgba(139, 92, 246, 0.04)' }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          How training data is collected
        </Typography>
        <Typography variant="body2" color="text.secondary">
          A record is created automatically after every PR review. Reviewers then provide feedback
          via the Observability drill-down (thumbs up/down on each finding), GitHub comment
          reactions (👍/👎), or PR approval/changes-requested events. Each feedback submission
          recomputes the precision, recall, and RL reward for that record. Use the Export buttons
          to download the full dataset for fine-tuning.
        </Typography>
      </Paper>
    </Box>
  );
}
