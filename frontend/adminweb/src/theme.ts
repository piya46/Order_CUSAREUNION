import { createTheme } from '@mui/material/styles';

export default createTheme({
  palette: {
    primary: { main: '#1677ff' },
    success: { main: '#07C160' }
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700 } } }
  }
});