import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import TerminalIcon from '@mui/icons-material/Terminal';
import GavelIcon from '@mui/icons-material/Gavel';
import CloudIcon from '@mui/icons-material/Cloud';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BuildIcon from '@mui/icons-material/Build';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import InsightsIcon from '@mui/icons-material/Insights';

interface Props {
  activeTab: number;
  onTabChange: (tab: number) => void;
}

const SIDEBAR_WIDTH = 280;

const menuItems = [
  {
    id: 0,
    label: 'Code Review',
    icon: <TerminalIcon />,
    color: '#EC4899',
  },
  {
    id: 1,
    label: 'Validation Rules',
    icon: <GavelIcon />,
    color: '#6366F1',
  },
  {
    id: 2,
    label: 'LLM Settings',
    icon: <CloudIcon />,
    color: '#8B5CF6',
  },
  {
    id: 3,
    label: 'Architecture',
    icon: <AccountTreeIcon />,
    color: '#3B82F6',
  },
  {
    id: 4,
    label: 'CI/CD Integration',
    icon: <BuildIcon />,
    color: '#10B981',
  },
  {
    id: 5,
    label: 'Add to Existing Pipeline',
    icon: <IntegrationInstructionsIcon />,
    color: '#8B5CF6',
  },
];

const observabilityItem = {
  id: 8,
  label: 'Agent Observability',
  icon: <InsightsIcon />,
  color: '#F59E0B',
};

export default function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(15,15,20,0.4)'
            : 'rgba(250,250,250,0.8)',
        backdropFilter: 'blur(12px)',
        overflow: 'auto',
      }}
    >
      <Box sx={{ p: 2 }}>
        <Typography
          variant="overline"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: 1.2,
            color: 'text.secondary',
            display: 'block',
            px: 1,
          }}
        >
          CODE QUALITY
        </Typography>
      </Box>
      <Divider sx={{ mx: 2, mb: 1 }} />
      <List sx={{ px: 2 }}>
        {menuItems.slice(0, 2).map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
              sx={{
                borderRadius: 1.5,
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'rgba(99, 102, 241, 0.08)',
                  color: item.color,
                  '& .MuiListItemIcon-root': {
                    color: item.color,
                  },
                  '&:hover': {
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(99, 102, 241, 0.12)',
                  },
                },
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: activeTab === item.id ? 600 : 500,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ px: 2, pt: 3 }}>
        <Typography
          variant="overline"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: 1.2,
            color: 'text.secondary',
            display: 'block',
            px: 1,
          }}
        >
          CONFIGURATION
        </Typography>
      </Box>
      <Divider sx={{ mx: 2, mb: 1 }} />
      <List sx={{ px: 2 }}>
        {menuItems.slice(2, 3).map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
              sx={{
                borderRadius: 1.5,
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'rgba(99, 102, 241, 0.08)',
                  color: item.color,
                  '& .MuiListItemIcon-root': {
                    color: item.color,
                  },
                  '&:hover': {
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(99, 102, 241, 0.12)',
                  },
                },
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: activeTab === item.id ? 600 : 500,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ px: 2, pt: 3 }}>
        <Typography
          variant="overline"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: 1.2,
            color: 'text.secondary',
            display: 'block',
            px: 1,
          }}
        >
          DOCUMENTATION
        </Typography>
      </Box>
      <Divider sx={{ mx: 2, mb: 1 }} />
      <List sx={{ px: 2 }}>
        {menuItems.slice(3).map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={activeTab === item.id}
              onClick={() => onTabChange(item.id)}
              sx={{
                borderRadius: 1.5,
                transition: 'all 0.2s',
                '&.Mui-selected': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'rgba(99, 102, 241, 0.08)',
                  color: item.color,
                  '& .MuiListItemIcon-root': {
                    color: item.color,
                  },
                  '&:hover': {
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(99, 102, 241, 0.2)'
                        : 'rgba(99, 102, 241, 0.12)',
                  },
                },
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: activeTab === item.id ? 600 : 500,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ px: 2, pt: 3 }}>
        <Typography
          variant="overline"
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: 1.2,
            color: 'text.secondary',
            display: 'block',
            px: 1,
          }}
        >
          OBSERVABILITY
        </Typography>
      </Box>
      <Divider sx={{ mx: 2, mb: 1 }} />
      <List sx={{ px: 2 }}>
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            selected={activeTab === observabilityItem.id}
            onClick={() => onTabChange(observabilityItem.id)}
            sx={{
              borderRadius: 1.5,
              transition: 'all 0.2s',
              '&.Mui-selected': {
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(245, 158, 11, 0.08)',
                color: observabilityItem.color,
                '& .MuiListItemIcon-root': {
                  color: observabilityItem.color,
                },
                '&:hover': {
                  bgcolor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(245, 158, 11, 0.12)',
                },
              },
              '&:hover': {
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
              {observabilityItem.icon}
            </ListItemIcon>
            <ListItemText
              primary={observabilityItem.label}
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: activeTab === observabilityItem.id ? 600 : 500,
              }}
            />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );
}
