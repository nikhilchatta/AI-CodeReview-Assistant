import { useState, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from './theme';
import AppLayout from './components/layout/AppLayout';

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppLayout darkMode={darkMode} onToggleDarkMode={() => setDarkMode(prev => !prev)} />
    </ThemeProvider>
  );
}
