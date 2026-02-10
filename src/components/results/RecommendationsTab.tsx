import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface Props {
  strengths: string[];
  recommendations: string[];
}

export default function RecommendationsTab({ strengths, recommendations }: Props) {
  return (
    <Box>
      {/* Strengths */}
      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <CheckCircleIcon sx={{ color: '#388E3C', fontSize: 20 }} />
        Strengths
      </Typography>
      <List dense disablePadding>
        {strengths.map((s, i) => (
          <ListItem key={i} sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <CheckCircleIcon sx={{ color: '#388E3C', fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary={s} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItem>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />

      {/* Recommendations */}
      <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <TrendingUpIcon sx={{ color: '#1976D2', fontSize: 20 }} />
        Recommendations
      </Typography>
      <List dense disablePadding>
        {recommendations.map((r, i) => (
          <ListItem key={i} sx={{ py: 0.25 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <TrendingUpIcon sx={{ color: '#1976D2', fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primary={r} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
