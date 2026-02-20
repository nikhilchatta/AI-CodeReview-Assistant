import { AppBar, Toolbar, Typography, Box, LinearProgress, Chip, Tooltip, IconButton } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TokenIcon from '@mui/icons-material/DataUsage';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useTokenStats } from '../../hooks/useTokenStats';

interface Props {
  aiStatus: 'idle' | 'analyzing' | 'done' | 'error';
  progress: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const STATUS_CONFIG = {
  idle: { label: 'Ready', color: '#71717A', pulse: false },
  analyzing: { label: 'Analyzing', color: '#6366F1', pulse: true },
  done: { label: 'Complete', color: '#10B981', pulse: false },
  error: { label: 'Error', color: '#EF4444', pulse: false },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function TopBar({ aiStatus, progress, darkMode, onToggleDarkMode }: Props) {
  const statusConfig = STATUS_CONFIG[aiStatus];
  const tokenStats = useTokenStats();

  return (
    <AppBar
      position="static"
      color="transparent"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        backdropFilter: 'blur(12px)',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(15,15,20,0.6)'
            : 'rgba(255,255,255,0.7)',
      }}
    >
      <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 48 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 800,
              fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #6366F1, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Code Review Assistant
          </Typography>
          <Chip
            label="AI Powered"
            size="small"
            sx={{
              fontSize: '0.65rem',
              fontWeight: 600,
              height: 20,
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.15))',
              border: '1px solid',
              borderColor: 'rgba(99, 102, 241, 0.3)',
              color: '#6366F1',
            }}
          />
        </Box>

        <Box sx={{ flex: 1 }} />

        {tokenStats.callCount > 0 && (
          <Tooltip title={`${tokenStats.callCount} API call${tokenStats.callCount > 1 ? 's' : ''} | In: ${tokenStats.totalInputTokens.toLocaleString()} | Out: ${tokenStats.totalOutputTokens.toLocaleString()} | Model: ${tokenStats.lastModel}`}>
            <Chip
              icon={<TokenIcon sx={{ fontSize: 13 }} />}
              label={`${formatTokens(tokenStats.totalInputTokens + tokenStats.totalOutputTokens)} tokens`}
              size="small"
              sx={{
                fontSize: '0.7rem',
                fontWeight: 500,
                height: 26,
                borderRadius: '8px',
                bgcolor: (theme: any) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            />
          </Tooltip>
        )}

        <Chip
          icon={
            statusConfig.pulse ? (
              <SmartToyIcon
                sx={{
                  fontSize: 14,
                  animation: 'topbar-pulse 1.5s ease-in-out infinite',
                  '@keyframes topbar-pulse': {
                    '0%,100%': { opacity: 1 },
                    '50%': { opacity: 0.4 },
                  },
                }}
              />
            ) : (
              <FiberManualRecordIcon sx={{ fontSize: 8 }} />
            )
          }
          label={statusConfig.label}
          size="small"
          sx={{
            height: 26,
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.7rem',
            bgcolor: `${statusConfig.color}18`,
            color: statusConfig.color,
            border: `1px solid ${statusConfig.color}30`,
            '& .MuiChip-icon': { color: statusConfig.color },
          }}
        />

        <IconButton size="small" onClick={onToggleDarkMode} sx={{ ml: 0.5 }}>
          {darkMode ? <Brightness7Icon sx={{ fontSize: 18 }} /> : <Brightness4Icon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Toolbar>
      {aiStatus === 'analyzing' && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 2,
            bgcolor: 'transparent',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #A78BFA)',
            },
          }}
        />
      )}
    </AppBar>
  );
}
