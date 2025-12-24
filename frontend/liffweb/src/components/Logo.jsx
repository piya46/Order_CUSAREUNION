
import { Box, styled } from '@mui/material';

const Float = styled('img')(({ theme, size }) => ({
  width: size || 120,
  height: size || 120,
  filter: 'drop-shadow(0 10px 24px rgba(217,119,6,.25))',
  userSelect: 'none',
  pointerEvents: 'none',
  animation: 'tgr-float 5.2s ease-in-out infinite, tgr-glow 3.8s ease-in-out infinite',
  '@keyframes tgr-float': {
    '0%,100%': { transform: 'translateY(0)' },
    '50%':     { transform: 'translateY(-8px)' },
  },
  '@keyframes tgr-glow': {
    '0%,100%': { filter: 'drop-shadow(0 10px 24px rgba(217,119,6,.22))' },
    '50%':     { filter: 'drop-shadow(0 16px 34px rgba(217,119,6,.36))' },
  },
}));

// วงโคจรจาง ๆ ด้านหลัง
const Orbit = styled('span')(({ theme, size }) => ({
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background:
    'radial-gradient(closest-side, rgba(245,158,11,.22), transparent 60%)',
  mask: 'radial-gradient(circle at center, transparent 48%, black 49%)',
  animation: 'tgr-spin 18s linear infinite',
  '@keyframes tgr-spin': { to: { transform: 'rotate(360deg)' } },
}));

export default function Logo({ size = 120 }) {
  return (
    <Box position="relative" sx={{ width: size, height: size }}>
      <Orbit size={size} />
      <Float src="/Logo.svg" alt="Tiger Logo" size={size} draggable={false} onContextMenu={(e)=>e.preventDefault()} />
    </Box>
  );
}