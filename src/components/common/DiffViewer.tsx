import { Box, Typography } from '@mui/material';
import type { DiffLine } from '../../types';

interface Props {
  diffLines: DiffLine[];
}

export default function DiffViewer({ diffLines }: Props) {
  return (
    <Box>
      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
        {[
          { label: 'Removed', color: 'rgba(248, 81, 73, 0.35)' },
          { label: 'Added / Changed', color: 'rgba(46, 160, 67, 0.35)' },
          { label: 'Unchanged', color: '#2d2d2d' },
        ].map(item => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: item.color }} />
            <Typography variant="caption">{item.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Diff */}
      <Box
        sx={{
          bgcolor: '#1e1e1e',
          borderRadius: 1,
          maxHeight: 500,
          overflow: 'auto',
          fontFamily: '"JetBrains Mono", "Consolas", monospace',
          fontSize: '0.85rem',
        }}
      >
        {diffLines.map((line, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              px: 1.5,
              py: '1px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              ...(line.type === 'added' && { bgcolor: 'rgba(46,160,67,0.20)', color: '#7ee787' }),
              ...(line.type === 'removed' && { bgcolor: 'rgba(248,81,73,0.20)', color: '#ffa198', textDecoration: 'line-through' }),
              ...(line.type === 'unchanged' && { color: '#d4d4d4' }),
            }}
          >
            <Box component="span" sx={{ minWidth: 40, textAlign: 'right', pr: 1.5, color: '#636363', userSelect: 'none', flexShrink: 0 }}>
              {line.type === 'removed' ? '' : line.lineNumber}
            </Box>
            <Box component="span" sx={{ width: 20, flexShrink: 0, textAlign: 'center' }}>
              {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
            </Box>
            <Box component="span" sx={{ flex: 1 }}>{line.content}</Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
