import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, Stack, Chip, Box,
  Switch, FormControlLabel, Typography,
} from '@mui/material';
import type { ValidationRule } from '../../types';

const SEVERITIES: ValidationRule['severity'][] = ['critical', 'high', 'medium', 'low', 'info'];

const CATEGORIES: ValidationRule['category'][] = [
  'security', 'performance', 'code-structure', 'maintainability',
  'data-quality', 'best-practice', 'logging', 'exception-handling',
];

const LANGUAGES: ValidationRule['languages'][number][] = [
  'pyspark', 'python', 'scala', 'sql', 'terraform',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (rule: ValidationRule) => void;
  rule?: ValidationRule | null;
  mode: 'add' | 'edit';
  nextId?: string;
}

const EMPTY: ValidationRule = {
  id: '',
  name: '',
  enabled: true,
  severity: 'medium',
  category: 'best-practice',
  message: '',
  suggestion: '',
  languages: ['pyspark'],
};

export default function RuleDialog({ open, onClose, onSave, rule, mode, nextId }: Props) {
  const [form, setForm] = useState<ValidationRule>({ ...EMPTY });
  const [patternStr, setPatternStr] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && rule) {
        setForm({ ...rule });
        setPatternStr(rule.pattern instanceof RegExp ? rule.pattern.source : typeof rule.pattern === 'string' ? rule.pattern : '');
      } else {
        setForm({ ...EMPTY, id: nextId || 'custom-001' });
        setPatternStr('');
      }
      setErrors({});
    }
  }, [open, mode, rule, nextId]);

  const set = (field: keyof ValidationRule, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value } as ValidationRule));
    setErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleSave = () => {
    const errs: Record<string, boolean> = {};
    if (!form.name.trim()) errs.name = true;
    if (!form.message.trim()) errs.message = true;
    if (!form.suggestion.trim()) errs.suggestion = true;
    if (form.languages.length === 0) errs.languages = true;
    if (!form.id.trim()) errs.id = true;

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const saved: ValidationRule = {
      ...form,
      pattern: patternStr.trim() ? new RegExp(patternStr.trim(), 'i') : undefined,
    };
    onSave(saved);
  };

  const toggleLanguage = (lang: ValidationRule['languages'][number]) => {
    const langs = form.languages.includes(lang)
      ? form.languages.filter(l => l !== lang)
      : [...form.languages, lang];
    set('languages', langs);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'add' ? 'Add New Rule' : 'Edit Rule'}</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          <TextField
            label="Rule ID"
            size="small"
            value={form.id}
            onChange={e => set('id', e.target.value)}
            disabled={mode === 'edit'}
            error={errors.id}
            helperText={mode === 'edit' ? 'ID cannot be changed' : 'e.g. custom-001'}
          />
          <TextField
            label="Name"
            size="small"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            error={errors.name}
            helperText={errors.name ? 'Required' : ''}
          />
          <Stack direction="row" gap={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select value={form.severity} label="Severity" onChange={e => set('severity', e.target.value)}>
                {SEVERITIES.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={form.category} label="Category" onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          <TextField
            label="Message"
            size="small"
            value={form.message}
            onChange={e => set('message', e.target.value)}
            error={errors.message}
            helperText={errors.message ? 'Required' : 'What the issue is'}
            multiline
            rows={2}
          />
          <TextField
            label="Suggestion"
            size="small"
            value={form.suggestion}
            onChange={e => set('suggestion', e.target.value)}
            error={errors.suggestion}
            helperText={errors.suggestion ? 'Required' : 'How to fix it'}
            multiline
            rows={2}
          />
          <TextField
            label="Pattern (Regex, optional)"
            size="small"
            value={patternStr}
            onChange={e => setPatternStr(e.target.value)}
            helperText="e.g. \.collect\(\) — leave empty if not needed"
            sx={{ fontFamily: 'monospace' }}
          />
          <Box>
            <Typography variant="caption" color={errors.languages ? 'error' : 'text.secondary'} sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>
              Languages {errors.languages ? '(select at least one)' : ''}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {LANGUAGES.map(lang => (
                <Chip
                  key={lang}
                  label={lang}
                  size="small"
                  variant={form.languages.includes(lang) ? 'filled' : 'outlined'}
                  color={form.languages.includes(lang) ? 'primary' : 'default'}
                  onClick={() => toggleLanguage(lang)}
                />
              ))}
            </Stack>
          </Box>
          <FormControlLabel
            control={<Switch checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />}
            label="Enabled"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          {mode === 'add' ? 'Add Rule' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
