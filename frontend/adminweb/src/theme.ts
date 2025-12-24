import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563EB', // Modern Blue
      light: '#60A5FA',
      dark: '#1E40AF',
    },
    secondary: {
      main: '#10B981', // Emerald Green (Success)
    },
    background: {
      default: '#F3F4F6', // Light Gray background for dashboard
      paper: '#FFFFFF',
    },
    status: {
      pending: '#F59E0B', // Amber
      processing: '#3B82F6', // Blue
      completed: '#10B981', // Green
      cancelled: '#EF4444', // Red
      backorder: '#8B5CF6', // Purple (สำหรับรอของ)
    }
  },
  typography: {
    fontFamily: '"Prompt", "Roboto", "Helvetica", "Arial", sans-serif', // ใช้ Prompt ให้เข้ากับภาษาไทย
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 }, // ปุ่มไม่ต้องตัวใหญ่หมด
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // ปุ่มมน
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 6 },
      },
    },
  },
});

export default theme;