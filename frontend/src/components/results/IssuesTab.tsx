import { useState } from 'react';
import { Box, Typography, Chip, Stack, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import SeverityChip from '../common/SeverityChip';
import type { CodeIssue } from '../../types';

interface Props {
  issues: CodeIssue[];
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function getSeverityIcon(severity: string) {
  switch (severity) {
    case 'critical': return <ErrorIcon sx={{ color: '#D32F2F' }} />;
    case 'high': return <WarningIcon sx={{ color: '#F57C00' }} />;
    case 'medium': return <InfoIcon sx={{ color: '#FFA726' }} />;
    case 'low': return <InfoIcon sx={{ color: '#1976D2' }} />;
    default: return <InfoIcon />;
  }
}

export default function IssuesTab({ issues }: Props) {
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);

  const filteredIssues = filterSeverity
    ? issues.filter(i => i.severity === filterSeverity)
    : issues;

  const sortedIssues = [...filteredIssues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  const severityCounts = SEVERITY_ORDER.reduce<Record<string, number>>((acc, sev) => {
    acc[sev] = issues.filter(i => i.severity === sev).length;
    return acc;
  }, {});

  return (
    <Box>
      {/* Filters */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip
          label={`All (${issues.length})`}
          size="small"
          variant={!filterSeverity ? 'filled' : 'outlined'}
          onClick={() => setFilterSeverity(null)}
        />
        {SEVERITY_ORDER.filter(s => severityCounts[s] > 0).map(sev => (
          <Chip
            key={sev}
            label={`${sev} (${severityCounts[sev]})`}
            size="small"
            variant={filterSeverity === sev ? 'filled' : 'outlined'}
            onClick={() => setFilterSeverity(filterSeverity === sev ? null : sev)}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Stack>

      {/* Issues List */}
      <List disablePadding>
        {sortedIssues.map((issue, idx) => (
          <ListItem key={idx} sx={{ alignItems: 'flex-start', py: 1.5, px: 0, borderBottom: 1, borderColor: 'divider' }}>
            <ListItemIcon sx={{ mt: 0.5, minWidth: 36 }}>
              {getSeverityIcon(issue.severity)}
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" sx={{ mb: 0.5 }}>
                  <SeverityChip severity={issue.severity} />
                  <Chip label={issue.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                  {issue.validationSource && (
                    <Chip
                      label={issue.validationSource === 'internal' ? 'Internal' : issue.validationSource === 'external' ? 'AI' : 'Both'}
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        bgcolor: issue.validationSource === 'internal' ? '#1976d220' : issue.validationSource === 'external' ? '#9c27b020' : '#ff980020',
                        color: issue.validationSource === 'internal' ? '#1976d2' : issue.validationSource === 'external' ? '#9c27b0' : '#ff9800',
                      }}
                    />
                  )}
                  {issue.lineNumber && (
                    <Typography variant="caption" color="text.secondary">Line {issue.lineNumber}</Typography>
                  )}
                </Stack>
              }
              secondary={
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>{issue.message}</Typography>
                  {issue.suggestion && (
                    <Typography variant="caption" color="primary" sx={{ whiteSpace: 'pre-wrap' }}>
                      Suggestion: {issue.suggestion}
                    </Typography>
                  )}
                  {issue.codeSnippet && (
                    <Box sx={{
                      mt: 0.5, p: 1, bgcolor: 'action.hover', borderRadius: 1,
                      fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'auto',
                    }}>
                      {issue.codeSnippet}
                    </Box>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>

      {sortedIssues.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No issues found{filterSeverity ? ` with severity "${filterSeverity}"` : ''}.
        </Typography>
      )}
    </Box>
  );
}
