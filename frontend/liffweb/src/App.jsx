// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { useEffect, useRef } from 'react';  // ถ้าเปิด DevtoolsWatch ให้คืนบรรทัดนี้
// import Swal from 'sweetalert2';

import { ThemeProvider, CssBaseline, GlobalStyles } from '@mui/material';
import tigerTheme from './theme/tigerTheme';

import { LiffProvider } from './context/LiffContext.jsx';
import { CartProvider } from './context/CartContext';

import Home from './pages/Home.jsx';
import Products from './pages/Products.jsx';
import OrderCreate from './pages/OrderCreate.jsx';
import OrderList from './pages/OrderList.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import UploadSlip from './pages/UploadSlip.jsx';
import NotFound from './pages/NotFound.jsx';
import OnlyInLine from './pages/OnlyInLine.jsx';
import Checkout from './pages/Checkout.jsx';
import Me from './pages/Me.jsx';

import HomeBackFab from './components/HomeBackFab.jsx';
import AppShell from './layouts/AppShell.jsx';

/** (option) DevtoolsWatch เดิม – ปิดไว้ก่อนเพื่อลด warning unused */
// function DevtoolsWatch() { return null; }

export default function App() {
  return (
    <LiffProvider>
      <CartProvider>
        <ThemeProvider theme={tigerTheme}>
          <CssBaseline />
          <GlobalStyles styles={{
            body: {
              background:
                'radial-gradient(1200px 600px at 10% -10%, rgba(245,158,11,.08), transparent 55%),' +
                'radial-gradient(1200px 600px at 90% 110%, rgba(251,146,60,.08), transparent 55%), #FFFDF6',
            },
            '::selection': { background: 'rgba(245,158,11,.25)' }
          }} />

          <BrowserRouter basename={import.meta.env.BASE_URL}>
            {/* <DevtoolsWatch /> */}
            {/* <HomeBackFab /> */}

            <AppShell>
              <Routes>
                <Route path="/only-in-line" element={<OnlyInLine />} />

                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/order/create" element={<OrderCreate />} />
                <Route path="/orders" element={<OrderList />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/orders/:id/upload-slip" element={<UploadSlip />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/me" element={<Me />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          </BrowserRouter>
        </ThemeProvider>
      </CartProvider>
    </LiffProvider>
  );
}