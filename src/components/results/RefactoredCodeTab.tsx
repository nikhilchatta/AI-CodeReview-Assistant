import { useState } from 'react';
import { Box, Tabs, Tab, Button, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DiffViewer from '../common/DiffViewer';
import SyntaxHighlighter from '../common/SyntaxHighlighter';
import { computeDiff } from '../../engine/diff';

interface Props {
  originalCode: string;
  fixedCode: string;
}

export default function RefactoredCodeTab({ originalCode, fixedCode }: Props) {
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fixedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const diffLines = computeDiff(originalCode, fixedCode);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)}>
          <Tab label="Diff View" />
          <Tab label="Full Code" />
        </Tabs>
        <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy Code'}
        </Button>
      </Box>

      {tab === 0 && <DiffViewer diffLines={diffLines} />}

      {tab === 1 && (
        <SyntaxHighlighter code={fixedCode} language="python" maxHeight={500} />
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Review the generated code carefully before using. Some fixes may require manual adjustment.
      </Typography>
    </Box>
  );
}
