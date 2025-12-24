// frontend/adminweb/src/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FFC107', // สีเหลือง Amber
      light: '#FFD54F',
      dark: '#FFA000',
      contrastText: '#000000', // ตัวหนังสือบนสีเหลืองต้องเป็นสีดำ
    },
    secondary: {
      main: '#212121', // สีดำ Charcoal
      light: '#484848',
      dark: '#000000',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F5F5',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
    error: { main: '#D32F2F' },
    warning: { main: '#ED6C02' },
    success: { main: '#2E7D32' },
    info: { main: '#0288D1' },
  },
  typography: {
    fontFamily: [
      '"Prompt"',
      '"Roboto"',
      '"Helvetica"',
      '"Arial"',
      'sans-serif',
    ].join(','),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#212121',
          color: '#FFC107',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
        containedPrimary: {
          '&:hover': { backgroundColor: '#FFB300' },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#FFFFFF',
          borderRight: '1px solid #E0E0E0',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, backgroundColor: '#FAFAFA' },
      },
    },
  },
});

export default theme;