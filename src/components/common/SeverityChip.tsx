import { Chip } from '@mui/material';

const SEVERITY_COLORS: Record<string, { bg: string; fg: string }> = {
  critical: { bg: '#D32F2F20', fg: '#D32F2F' },
  high: { bg: '#F57C0020', fg: '#F57C00' },
  medium: { bg: '#FFA72620', fg: '#F57C00' },
  low: { bg: '#1976D220', fg: '#1976D2' },
  info: { bg: '#66666620', fg: '#666666' },
};

interface Props {
  severity: string;
}

export default function SeverityChip({ severity }: Props) {
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.info;
  return (
    <Chip
      label={severity.toUpperCase()}
      size="small"
      sx={{ bgcolor: colors.bg, color: colors.fg, fontWeight: 700, fontSize: '0.7rem' }}
    />
  );
}
