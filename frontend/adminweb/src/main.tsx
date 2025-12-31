import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ThemeProvider, CssBaseline } from '@mui/material'
import theme from './theme'

import './index.css' 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)