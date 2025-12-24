// src/theme/tigerTheme.js
import { createTheme } from '@mui/material/styles';

const tigerTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#F59E0B', light: '#FCD34D', dark: '#D97706', contrastText: '#1f1300' }, // amber
    secondary: { main: '#FB923C', light: '#FED7AA', dark: '#EA580C', contrastText: '#1f1300' }, // orange
    warning:   { main: '#F59E0B' },
    success:   { main: '#16A34A' },
    info:      { main: '#0EA5E9' },
    background:{ default: '#FFFDF6', paper: '#FFFCF0' }, // ครีมอุ่น ๆ
    text:      { primary: '#2D1B00', secondary: '#6B4E16' }, // น้ำตาลอมทอง
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Noto Sans Thai", Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji"',
    h5: { fontWeight: 900, letterSpacing: .2 },
    h6: { fontWeight: 900 },
    button: { fontWeight: 800, textTransform: 'none' },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12 },
        containedPrimary: { boxShadow: '0 10px 22px rgba(245,158,11,.24)' },
        outlined: { borderColor: 'rgba(245,158,11,.35)' },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 800 } } },
  },
});

export default tigerTheme;