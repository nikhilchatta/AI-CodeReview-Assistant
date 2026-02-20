import { useState } from 'react';
import { Box, Paper, Tabs, Tab, Typography, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import CloudIcon from '@mui/icons-material/Cloud';
import CodeEditor from '../components/editor/CodeEditor';
import OverviewTab from '../components/results/OverviewTab';
import IssuesTab from '../components/results/IssuesTab';
import RefactoredCodeTab from '../components/results/RefactoredCodeTab';
import RecommendationsTab from '../components/results/RecommendationsTab';
import { useCodeAnalysis } from '../hooks/useCodeAnalysis';
import type { SupportedLanguage } from '../types';

interface Props {
  onAiStatusChange: (status: 'idle' | 'analyzing' | 'done' | 'error') => void;
  onProgressChange: (progress: number) => void;
}

export default function ReviewPage({ onAiStatusChange, onProgressChange }: Props) {
  const [code, setCode] = useState('');
  const [resultTab, setResultTab] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | 'auto'>('auto');

  const { result, loading, activeStep, steps, analyze, reset } = useCodeAnalysis(onAiStatusChange, onProgressChange);

  // Check if custom LLM is configured
  const customLLMEnabled = (() => {
    try {
      const config = localStorage.getItem('customLLMConfig');
      if (config) {
        const parsed = JSON.parse(config);
        return parsed.enabled && parsed.baseUrl && parsed.clientId;
      }
    } catch (e) {
      // Ignore
    }
    return false;
  })();

  const handleAnalyze = () => {
    if (code.trim()) {
      setResultTab(0);
      analyze(code, selectedLanguage);
    }
  };

  const handleClear = () => {
    setCode('');
    reset();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2 }}>
      {/* Language Selector & LLM Indicator */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        {customLLMEnabled && (
          <Chip
            icon={<CloudIcon sx={{ fontSize: 16 }} />}
            label="Using Custom LLM"
            size="small"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              height: 28,
              borderRadius: '8px',
              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6',
              border: '1px solid rgba(139, 92, 246, 0.3)',
            }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Language</InputLabel>
          <Select
            value={selectedLanguage}
            label="Language"
            onChange={(e) => setSelectedLanguage(e.target.value as SupportedLanguage | 'auto')}
          >
            <MenuItem value="auto">Auto Detect</MenuItem>
            <MenuItem value="pyspark">PySpark</MenuItem>
            <MenuItem value="python">Python</MenuItem>
            <MenuItem value="scala">Scala</MenuItem>
            <MenuItem value="sql">SQL</MenuItem>
            <MenuItem value="terraform">Terraform</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Main Split Panels */}
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* Left Panel - Code Editor */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            border: 1,
            borderColor: 'divider',
            minWidth: 0,
          }}
        >
          <CodeEditor
            code={code}
            onChange={setCode}
            onAnalyze={handleAnalyze}
            onClear={handleClear}
            loading={loading}
            activeStep={activeStep}
            steps={steps}
          />
        </Paper>

        {/* Right Panel - Results */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: 1,
            borderColor: 'divider',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {result ? (
            <>
              <Tabs
                value={resultTab}
                onChange={(_e, v) => setResultTab(v)}
                sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}
              >
                <Tab label="Overview" />
                <Tab label={`Issues (${result.issues.length})`} />
                {result.fixedCode && <Tab label="Refactored Code" />}
                <Tab label="Recommendations" />
              </Tabs>
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {resultTab === 0 && <OverviewTab result={result} />}
                {resultTab === 1 && <IssuesTab issues={result.issues} />}
                {resultTab === 2 && result.fixedCode && result.originalCode && (
                  <RefactoredCodeTab originalCode={result.originalCode} fixedCode={result.fixedCode} />
                )}
                {resultTab === (result.fixedCode ? 3 : 2) && (
                  <RecommendationsTab strengths={result.strengths} recommendations={result.recommendations} />
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4 }}>
              <Typography variant="body1" color="text.secondary" textAlign="center">
                Paste your code on the left and click <strong>Analyze Code</strong> to get started.
                <br /><br />
                Supports PySpark, Python, Scala, SQL, and Terraform.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
