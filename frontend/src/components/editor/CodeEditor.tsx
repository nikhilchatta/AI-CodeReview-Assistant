import { Box, TextField, Button, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

interface Props {
  code: string;
  onChange: (code: string) => void;
  onAnalyze: () => void;
  onClear: () => void;
  loading: boolean;
  activeStep: number;
  steps: string[];
}

export default function CodeEditor({ code, onChange, onAnalyze, onClear, loading, activeStep, steps }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (code.trim() && !loading) onAnalyze();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Paste your code below
        </Typography>
        {loading && (
          <Typography variant="caption" color="primary">
            {steps[Math.min(activeStep, steps.length - 1)]}
          </Typography>
        )}
      </Box>
      <TextField
        fullWidth
        multiline
        value={code}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        placeholder="Paste your code here... (Ctrl+Enter to analyze)"
        sx={{
          flex: 1,
          '& .MuiInputBase-root': {
            height: '100%',
            alignItems: 'flex-start',
            fontFamily: '"JetBrains Mono", "Consolas", monospace',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          },
          '& .MuiInputBase-input': {
            height: '100% !important',
            overflow: 'auto !important',
          },
        }}
      />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={onAnalyze}
          disabled={!code.trim() || loading}
          sx={{ flex: 1 }}
        >
          {loading ? 'Analyzing...' : 'Analyze Code'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<DeleteOutlineIcon />}
          onClick={onClear}
          disabled={loading}
        >
          Clear
        </Button>
      </Stack>
    </Box>
  );
}
