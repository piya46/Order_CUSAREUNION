import { useMemo } from 'react';
import {
  Paper, Box, Stack, Badge, alpha, Portal, ButtonBase, Typography
} from '@mui/material';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import PersonIcon from '@mui/icons-material/Person';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export const FOOTER_HEIGHT = 64; // base height (ไม่รวม safe-area)
const vibe = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };

const NAV_ITEMS = [
  { value: '/',         label: 'หน้าหลัก',  icon: HomeRoundedIcon },
  { value: '/checkout', label: 'ตะกร้า',    icon: ShoppingCartIcon },
  { value: '/orders',   label: 'ออร์เดอร์', icon: AssignmentTurnedInIcon },
  { value: '/me',       label: 'ฉัน',       icon: PersonIcon },
];

export default function FooterNav() {
  const { totals } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => {
    const p = location.pathname;
    if (p === '/' || p.startsWith('/home')) return '/';
    if (p.startsWith('/checkout'))          return '/checkout';
    if (p.startsWith('/orders'))            return '/orders';
    if (p.startsWith('/me'))                return '/me';
    return '/';
  }, [location.pathname]);

  const onGo = (val) => {
    if (val === current) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      vibe(); return;
    }
    navigate(val); vibe();
  };

  const bar = (
    <Paper
      id="app-footer-nav" // ✅ ให้ hook วัดความสูงเจอ
      role="contentinfo"
      elevation={3}
      sx={(t)=>({
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        zIndex: t.zIndex.appBar + 10,
        '--sab': 'env(safe-area-inset-bottom, 0px)',
        minHeight: `calc(${FOOTER_HEIGHT}px + var(--sab))`,
        boxSizing: 'border-box',
        paddingBottom: 'calc(8px + var(--sab))',
        backdropFilter: 'saturate(150%) blur(12px)',
        background: `linear-gradient(180deg, ${alpha(t.palette.background.paper,.80)}, ${alpha(t.palette.background.paper,.96)})`,
        borderTop: `1px solid ${alpha(t.palette.primary.light,.25)}`
      })}
    >
      <Box sx={{ maxWidth: 1080, mx: 'auto', px: 1 }}>
        <Stack direction="row" alignItems="stretch" justifyContent="space-between">
          {NAV_ITEMS.map((it) => {
            const Icon = it.icon;
            const active = current === it.value;
            const isCart = it.value === '/checkout';
            const count = useCart()?.totals?.count || 0;

            return (
              <ButtonBase
                key={it.value}
                onClick={() => onGo(it.value)}
                sx={(t)=>({
                  flex: 1,
                  borderRadius: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: .25,
                  py: 1, // ✅ พื้นที่แตะใหญ่
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0, left: 0, right: 0, height: 3,
                    background: active ? t.palette.primary.main : 'transparent'
                  },
                  color: active ? t.palette.primary.main : t.palette.text.secondary,
                  fontWeight: active ? 800 : 600,
                })}
              >
                {isCart ? (
                  <Badge color="secondary" badgeContent={Math.min(999, count)} max={999}>
                    <Icon fontSize="medium" />
                  </Badge>
                ) : <Icon fontSize="medium" />}
                <Typography variant="caption" sx={{ lineHeight: 1.1, fontWeight: 800 }}>
                  {it.label}
                </Typography>
                <Typography variant="caption" sx={{ fontSize: 10, opacity: .7, mt: -.2 }}>
                  {isCart ? (count > 0 ? `${count} ชิ้น` : 'ว่าง') : (it.value === '/orders' ? 'ติดตามสถานะ' : ' ')}
                </Typography>
              </ButtonBase>
            );
          })}
        </Stack>
      </Box>
    </Paper>
  );

  return <Portal>{bar}</Portal>;
}