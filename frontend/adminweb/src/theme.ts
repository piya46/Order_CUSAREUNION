import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    status: {
      pending: string;
      processing: string;
      completed: string;
      cancelled: string;
      backorder: string;
    };
  }
  interface PaletteOptions {
    status?: {
      pending?: string;
      processing?: string;
      completed?: string;
      cancelled?: string;
      backorder?: string;
    };
  }
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FFB300', // Amber 600 - สีเหลืองทองสวยๆ
      light: '#FFE54C',
      dark: '#C68400',
      contrastText: '#212121', // ตัวหนังสือสีเข้มเพื่อให้อ่านง่ายบนพื้นเหลือง
    },
    secondary: {
      main: '#212121', // สีดำ Charcoal (แทนลายเสือ)
    },
    background: {
      default: '#FFFDF5', // พื้นหลังขาวอมเหลืองนวลๆ สบายตา
      paper: '#FFFFFF',
    },
    status: {
      pending: '#FF8F00', // Amber Dark
      processing: '#1E88E5', // Blue
      completed: '#43A047', // Green
      cancelled: '#E53935', // Red
      backorder: '#8E24AA', // Purple
    }
  },
  typography: {
    fontFamily: '"Prompt", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800, letterSpacing: -1 },
    h2: { fontWeight: 700, letterSpacing: -0.5 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 700, fontSize: '1rem' },
  },
  shape: {
    borderRadius: 16, // เพิ่มความมนให้ดู Friendly ขึ้น
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: 'none',
          padding: '10px 24px',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(255, 179, 0, 0.4)', // เงาสีเหลืองเวลานำเมาส์ไปวาง
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s ease-in-out',
        },
        containedPrimary: {
          color: '#212121', // ปุ่มสีเหลือง ตัวหนังสือสีดำ
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(0,0,0,0.03)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8 },
        filled: { border: '1px solid transparent' },
        outlined: { border: '1px solid currentColor', fontWeight: 700 },
      },
    },
  },
});

export default theme;