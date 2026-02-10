import { Box, Typography } from '@mui/material';

interface Props {
  label: string;
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#388E3C';
  if (score >= 60) return '#F57C00';
  return '#D32F2F';
}

export default function ScoreCard({ label, score }: Props) {
  const color = getScoreColor(score);

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: `${color}10`,
        border: `1px solid ${color}30`,
        textAlign: 'center',
        minWidth: 100,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ color, fontWeight: 700, mt: 0.5 }}>
        {score}
      </Typography>
    </Box>
  );
}
