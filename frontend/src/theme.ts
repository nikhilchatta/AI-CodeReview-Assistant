import { createTheme, alpha } from '@mui/material/styles';

export function createAppTheme(darkMode: boolean) {
  const primary = '#4F46E5'; // Modern indigo
  const secondary = '#0891B2'; // Teal accent

  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: { main: primary },
      secondary: { main: secondary },
      background: darkMode
        ? { default: '#18181B', paper: '#27272A' }
        : { default: '#F8FAFC', paper: '#FFFFFF' },
      divider: darkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.08),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h5: { fontWeight: 700 },
      h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            borderRadius: 8,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation0: {
            border: `1px solid ${darkMode ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.08)}`,
          },
          elevation1: {
            boxShadow: darkMode
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            border: `1px solid ${darkMode ? alpha('#FFFFFF', 0.06) : alpha('#000000', 0.06)}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 500 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none' as const, fontWeight: 500 },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
    },
  });
}
