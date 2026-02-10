import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloudIcon from '@mui/icons-material/Cloud';

interface LLMConfig {
  enabled: boolean;
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  model: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  models?: Array<{ id: string; name: string }>;
}

const DEFAULT_CONFIG: LLMConfig = {
  enabled: false,
  baseUrl: '',
  tokenUrl: '',
  clientId: '',
  clientSecret: '',
  model: '',
};

export default function LLMSettingsPage() {
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  useEffect(() => {
    // Load saved config from localStorage
    const saved = localStorage.getItem('customLLMConfig');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load LLM config:', e);
      }
    }
  }, []);

  const handleValidate = async () => {
    setValidating(true);
    setValidation(null);

    try {
      const response = await fetch('/api/ai-platform/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: config.baseUrl,
          tokenUrl: config.tokenUrl,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        }),
      });

      const result = await response.json();
      setValidation(result);
    } catch (error: any) {
      setValidation({
        valid: false,
        error: 'Failed to validate: ' + error.message,
      });
    } finally {
      setValidating(false);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('customLLMConfig', JSON.stringify(config));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleClear = () => {
    setConfig(DEFAULT_CONFIG);
    setValidation(null);
    localStorage.removeItem('customLLMConfig');
    setSaveStatus('idle');
  };

  const isFormValid = config.baseUrl && config.tokenUrl && config.clientId && config.clientSecret;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <CloudIcon sx={{ fontSize: 32, color: '#6366F1' }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Custom LLM Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Connect to your own LLM provider using OAuth 2.0 client credentials flow
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Enable/Disable Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight={600}>
                  Enable Custom LLM
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  When enabled, code reviews will use your custom LLM instead of Claude AI
                </Typography>
              </Box>
            }
          />

          <Alert severity="info" sx={{ mt: 1 }}>
            Your custom LLM must support OpenAI-compatible API format (e.g., /v1/chat/completions endpoint)
          </Alert>

          {/* Configuration Fields */}
          <TextField
            label="Base URL"
            placeholder="https://api.your-llm-provider.com"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            fullWidth
            helperText="API endpoint for your LLM (without /v1/* path)"
            disabled={!config.enabled}
          />

          <TextField
            label="OAuth Token URL"
            placeholder="https://auth.your-provider.com/oauth2/token"
            value={config.tokenUrl}
            onChange={(e) => setConfig({ ...config, tokenUrl: e.target.value })}
            fullWidth
            helperText="OAuth 2.0 token endpoint for client credentials flow"
            disabled={!config.enabled}
          />

          <TextField
            label="Client ID"
            placeholder="your-client-id"
            value={config.clientId}
            onChange={(e) => setConfig({ ...config, clientId: e.target.value })}
            fullWidth
            disabled={!config.enabled}
          />

          <TextField
            label="Client Secret"
            type="password"
            placeholder="your-client-secret"
            value={config.clientSecret}
            onChange={(e) => setConfig({ ...config, clientSecret: e.target.value })}
            fullWidth
            disabled={!config.enabled}
          />

          {/* Validation Section */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button
              variant="outlined"
              onClick={handleValidate}
              disabled={!isFormValid || !config.enabled || validating}
              startIcon={validating ? <CircularProgress size={16} /> : null}
            >
              {validating ? 'Validating...' : 'Test Connection'}
            </Button>

            {validation && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {validation.valid ? (
                  <>
                    <CheckCircleIcon sx={{ color: '#10B981', fontSize: 20 }} />
                    <Typography variant="body2" color="#10B981" fontWeight={600}>
                      Connected successfully
                    </Typography>
                    {validation.models && (
                      <Chip
                        label={`${validation.models.length} models available`}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <ErrorIcon sx={{ color: '#EF4444', fontSize: 20 }} />
                    <Typography variant="body2" color="#EF4444">
                      {validation.error}
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Box>

          {/* Model Selection */}
          {validation?.valid && validation.models && (
            <FormControl fullWidth>
              <InputLabel>Model</InputLabel>
              <Select
                value={config.model}
                label="Model"
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              >
                {validation.models.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Save/Clear Actions */}
          <Divider />

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={handleClear}>
              Clear Settings
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!config.enabled || !isFormValid}
              color={saveStatus === 'saved' ? 'success' : 'primary'}
            >
              {saveStatus === 'saved' ? 'Saved!' : 'Save Configuration'}
            </Button>
          </Box>

          {saveStatus === 'error' && (
            <Alert severity="error">Failed to save configuration</Alert>
          )}
        </Box>
      </Paper>

      {/* Usage Instructions */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mt: 3,
          border: 1,
          borderColor: 'divider',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.02)',
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Setup Instructions
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            <li>Obtain OAuth 2.0 client credentials from your LLM provider</li>
            <li>Enter your API endpoint and OAuth token URL above</li>
            <li>Click "Test Connection" to verify your credentials</li>
            <li>Select your preferred model from the dropdown</li>
            <li>Enable the toggle and save your configuration</li>
            <li>Your code reviews will now use the custom LLM</li>
          </ol>
        </Typography>
      </Paper>
    </Box>
  );
}
