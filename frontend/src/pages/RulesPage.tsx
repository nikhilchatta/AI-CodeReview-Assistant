import { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, TextField, Chip, Stack, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, InputAdornment,
  Accordion, AccordionSummary, AccordionDetails, Tooltip, IconButton,
  Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import SeverityChip from '../components/common/SeverityChip';
import RuleDialog from '../components/rules/RuleDialog';
import { useRules } from '../hooks/useRules';
import type { ValidationRule, ValidationStandards } from '../types';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  security: 'Security',
  performance: 'Performance',
  'code-structure': 'Code Structure',
  maintainability: 'Maintainability',
  'data-quality': 'Data Quality',
  'best-practice': 'Best Practice',
  logging: 'Logging',
  'exception-handling': 'Exception Handling',
};

const LANGUAGE_GROUPS: { key: keyof ValidationStandards; label: string; color: string }[] = [
  { key: 'pyspark', label: 'PySpark', color: '#E36209' },
  { key: 'python', label: 'Python', color: '#3572A5' },
  { key: 'scala', label: 'Scala', color: '#DC322F' },
  { key: 'sql', label: 'SQL', color: '#e38c00' },
  { key: 'terraform', label: 'Terraform', color: '#5C4EE5' },
  { key: 'security', label: 'Security', color: '#D32F2F' },
  { key: 'common', label: 'Common', color: '#666' },
];

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info'] as const;

export default function RulesPage() {
  const { rules, addRule, updateRule, deleteRule, toggleRule, resetToDefaults } = useRules();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [languageFilter, setLanguageFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [dialogGroup, setDialogGroup] = useState<keyof ValidationStandards>('common');
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ group: keyof ValidationStandards; rule: ValidationRule } | null>(null);

  // Reset confirmation
  const [resetOpen, setResetOpen] = useState(false);

  const totalCount = useMemo(
    () => LANGUAGE_GROUPS.reduce((sum, lg) => sum + rules[lg.key].length, 0),
    [rules],
  );

  const filteredGroups = useMemo(() => {
    const result: Record<string, ValidationRule[]> = {};
    const q = search.toLowerCase();

    for (const lg of LANGUAGE_GROUPS) {
      if (languageFilter !== 'all' && lg.key !== languageFilter) continue;

      const filtered = rules[lg.key].filter(rule => {
        if (severityFilter !== 'all' && rule.severity !== severityFilter) return false;
        if (q && !rule.name.toLowerCase().includes(q) && !rule.message.toLowerCase().includes(q) && !rule.id.toLowerCase().includes(q)) return false;
        return true;
      });

      if (filtered.length > 0) result[lg.key] = filtered;
    }
    return result;
  }, [rules, search, severityFilter, languageFilter]);

  const filteredCount = Object.values(filteredGroups).reduce((sum, r) => sum + r.length, 0);

  // Generate next custom ID
  const nextId = useMemo(() => {
    const allIds = LANGUAGE_GROUPS.flatMap(lg => rules[lg.key].map(r => r.id));
    const customIds = allIds.filter(id => id.startsWith('custom-'));
    const maxNum = customIds.reduce((max, id) => {
      const n = parseInt(id.replace('custom-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return `custom-${String(maxNum + 1).padStart(3, '0')}`;
  }, [rules]);

  const handleAdd = useCallback((group: keyof ValidationStandards) => {
    setDialogMode('add');
    setDialogGroup(group);
    setEditingRule(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((group: keyof ValidationStandards, rule: ValidationRule) => {
    setDialogMode('edit');
    setDialogGroup(group);
    setEditingRule(rule);
    setDialogOpen(true);
  }, []);

  const handleDialogSave = useCallback((rule: ValidationRule) => {
    if (dialogMode === 'add') {
      addRule(dialogGroup, rule);
    } else {
      updateRule(dialogGroup, rule.id, rule);
    }
    setDialogOpen(false);
  }, [dialogMode, dialogGroup, addRule, updateRule]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      deleteRule(deleteTarget.group, deleteTarget.rule.id);
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteRule]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    setResetOpen(false);
  }, [resetToDefaults]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Validation Rules
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {totalCount} internal rules configured across {LANGUAGE_GROUPS.length} categories
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RestoreIcon />}
            onClick={() => setResetOpen(true)}
          >
            Reset to Defaults
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleAdd('common')}
          >
            Add Rule
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack gap={2}>
          <TextField
            size="small"
            placeholder="Search rules by name, ID, or message..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            fullWidth
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Language / Group
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              <Chip
                label="All"
                size="small"
                variant={languageFilter === 'all' ? 'filled' : 'outlined'}
                onClick={() => setLanguageFilter('all')}
                color={languageFilter === 'all' ? 'primary' : 'default'}
              />
              {LANGUAGE_GROUPS.map(lg => (
                <Chip
                  key={lg.key}
                  label={lg.label}
                  size="small"
                  variant={languageFilter === lg.key ? 'filled' : 'outlined'}
                  onClick={() => setLanguageFilter(lg.key)}
                  sx={{
                    borderColor: lg.color,
                    color: languageFilter === lg.key ? '#fff' : lg.color,
                    bgcolor: languageFilter === lg.key ? lg.color : 'transparent',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Severity
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {SEVERITIES.map(s => (
                <Chip
                  key={s}
                  label={s === 'all' ? 'All' : s.toUpperCase()}
                  size="small"
                  variant={severityFilter === s ? 'filled' : 'outlined'}
                  onClick={() => setSeverityFilter(s)}
                  color={severityFilter === s ? 'primary' : 'default'}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      {/* Results count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Showing {filteredCount} of {totalCount} rules
      </Typography>

      {/* Rule groups */}
      {LANGUAGE_GROUPS.filter(lg => filteredGroups[lg.key]).map(lg => {
        const groupRules = filteredGroups[lg.key];
        const sorted = [...groupRules].sort(
          (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
        );

        return (
          <Accordion key={lg.key} defaultExpanded disableGutters sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" alignItems="center" gap={1} sx={{ flex: 1 }}>
                <Chip label={lg.label} size="small" sx={{ bgcolor: lg.color, color: '#fff', fontWeight: 600, fontSize: '0.75rem' }} />
                <Typography variant="body2" color="text.secondary">
                  {groupRules.length} rule{groupRules.length !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={`Add rule to ${lg.label}`}>
                  <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); handleAdd(lg.key); }}
                    sx={{ mr: 1 }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 110 }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 90 }}>Severity</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 140 }}>Category</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Message</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Suggestion</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 70, textAlign: 'center' }}>Enabled</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: 90, textAlign: 'center' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sorted.map(rule => (
                      <TableRow key={rule.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {rule.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{rule.name}</Typography>
                          {rule.languages.length > 1 && (
                            <Stack direction="row" gap={0.3} sx={{ mt: 0.3 }}>
                              {rule.languages.map(l => (
                                <Chip key={l} label={l} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                        <TableCell><SeverityChip severity={rule.severity} /></TableCell>
                        <TableCell>
                          <Chip label={CATEGORY_LABELS[rule.category] || rule.category} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{rule.message}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{rule.suggestion}</Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Tooltip title={rule.enabled ? 'Click to disable' : 'Click to enable'}>
                            <IconButton size="small" onClick={() => toggleRule(lg.key, rule.id)}>
                              {rule.enabled
                                ? <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                                : <CancelIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => handleEdit(lg.key, rule)}>
                              <EditIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" onClick={() => setDeleteTarget({ group: lg.key, rule })} color="error">
                              <DeleteIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        );
      })}

      {filteredCount === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No rules match the current filters.</Typography>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <RuleDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleDialogSave}
        rule={editingRule}
        mode={dialogMode}
        nextId={nextId}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete Rule</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete rule <strong>{deleteTarget?.rule.id}</strong> ({deleteTarget?.rule.name})?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Reset Confirmation */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)}>
        <DialogTitle>Reset to Defaults</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will discard all custom rules and changes, restoring the original built-in rules. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button onClick={handleReset} color="warning" variant="contained">Reset</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
