import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { KitchenDisplay } from './components/KitchenDisplay';

// Dense ops-dashboard look: small type, tight spacing.
const theme = createTheme({
  typography: { fontSize: 13 },
  spacing: 6,
});

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" elevation={0}>
        <Toolbar variant="dense">
          <Typography variant="h6" component="h1">
            Kitchen Display
          </Typography>
        </Toolbar>
      </AppBar>
      {/* Extra bottom padding keeps the last row's buttons clear of the floating + button. */}
      <Box component="main" sx={{ p: 2, pb: 12 }}>
        <KitchenDisplay />
      </Box>
    </ThemeProvider>
  );
}
