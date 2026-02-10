import { Box, Typography, Alert } from '@mui/material';
import ScoreCard from '../common/ScoreCard';
import type { CodeReviewResult } from '../../types';

interface Props {
  result: CodeReviewResult;
}

export default function OverviewTab({ result }: Props) {
  return (
    <Box>
      {result.aiApiUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Claude AI API Unavailable:</strong> Results are based on internal pattern matching only.
          {result.aiApiError && <><br /><em>Error: {result.aiApiError}</em></>}
          <br />
          <Typography variant="caption">
            To enable AI analysis, configure the ANTHROPIC_API_KEY environment variable.
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 2, mb: 3 }}>
        <ScoreCard label="Overall" score={result.overallScore} />
        <ScoreCard label="Code Quality" score={result.codeQuality} />
        <ScoreCard label="Performance" score={result.performance} />
        <ScoreCard label="Security" score={result.security} />
        <ScoreCard label="Maintainability" score={result.maintainability} />
      </Box>

      <Typography variant="body2" color="text.secondary">
        {result.summary}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Estimated Refactoring Effort: {result.estimatedRefactoringEffort}
      </Typography>
    </Box>
  );
}
