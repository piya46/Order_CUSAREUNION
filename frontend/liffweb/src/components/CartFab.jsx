// src/components/CartFab.jsx
import { Fab, Badge, Tooltip } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import HomeIcon from '@mui/icons-material/Home';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function CartFab() {
  const { totals } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const goCheckout = () => navigate('/checkout');
  const goHome = () => navigate('/');

  return (
    <>
      {/* กลับหน้าแรก (ซ้ายล่าง) */}
      {pathname !== '/' && (
        <Tooltip title="กลับหน้าแรก">
          <Fab
            size="medium"
            onClick={goHome}
            sx={{
              position: 'fixed', left: 16, bottom: 16, zIndex: 1200,
              bgcolor: 'white', color: 'text.primary', border: '1px solid #e6eefc',
              boxShadow: '0 8px 22px rgba(17,42,134,.10)'
            }}
          >
            <HomeIcon />
          </Fab>
        </Tooltip>
      )}

      {/* ตะกร้า (ขวาล่าง) */}
      <Tooltip title="ไปตะกร้า">
        <Fab
          color="primary"
          onClick={goCheckout}
          sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1200 }}
        >
          <Badge
            color="secondary"
            invisible={!totals?.count}
            badgeContent={totals?.count || 0}
            max={99}
            overlap="circular"
          >
            <ShoppingCartIcon />
          </Badge>
        </Fab>
      </Tooltip>
    </>
  );
}