// src/components/SideNav.tsx
import { useMemo, useState, useEffect } from "react";
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, Chip, alpha
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";

// Icons
import DashboardIcon from "@mui/icons-material/Dashboard";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import MoveDownIcon from "@mui/icons-material/MoveDown";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import GroupIcon from "@mui/icons-material/Group";
import SecurityIcon from "@mui/icons-material/Security";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import StoreIcon from "@mui/icons-material/Store";
import WarehouseIcon from "@mui/icons-material/Warehouse"; // ไอคอน Inventory

import { getUser } from "../lib/session";

const drawerWidth = 280;

type GroupItem = {
  id: string;
  label: string;
  items: { to: string; label: string; icon?: React.ReactNode; perm?: string }[];
};

const GROUPS: GroupItem[] = [
  {
    id: "ops",
    label: "หน้าร้าน (Front Office)",
    items: [
      { to: "/", label: "ภาพรวม (Dashboard)", icon: <DashboardIcon /> },
      { to: "/orders", label: "รายการคำสั่งซื้อ", icon: <ReceiptLongIcon />, perm: "order:manage" },
      { to: "/products", label: "ข้อมูลสินค้า (Catalog)", icon: <Inventory2Icon />, perm: "product:manage" },
    ]
  },
  {
    id: "supply_chain",
    label: "จัดการคลัง & จัดซื้อ (Back Office)",
    items: [
      { to: "/inventory", label: "บริหารสต็อก (Inventory)", icon: <WarehouseIcon />, perm: "product:manage" }, // ✅ เมนูใหม่
      { to: "/po", label: "ใบสั่งซื้อ (PO)", icon: <ShoppingCartIcon />, perm: "po:manage" },
      { to: "/receiving", label: "รับสินค้าเข้า (Receiving)", icon: <MoveDownIcon />, perm: "receiving:manage" },
      { to: "/suppliers", label: "ผู้ขาย (Suppliers)", icon: <StoreIcon />, perm: "po:manage" }, 
    ]
  },
  {
    id: "support",
    label: "บริการลูกค้า (Support)",
    items: [
      { to: "/issues", label: "แจ้งปัญหา/ช่วยเหลือ", icon: <ReportProblemIcon />, perm: "issue:manage" },
    ]
  },
  {
    id: "admin",
    label: "ผู้ดูแลระบบ (Admin)",
    items: [
      { to: "/users", label: "ผู้ใช้งานระบบ", icon: <GroupIcon />, perm: "user:manage" },
      { to: "/roles", label: "สิทธิ์การใช้งาน", icon: <SecurityIcon />, perm: "role:manage" },
      { to: "/audit", label: "ประวัติการใช้งาน", icon: <FactCheckIcon />, perm: "audit:manage" },
    ]
  },
];

export default function SideNav({
  mobileOpen, onClose, variant = "permanent"
}: { mobileOpen?: boolean; onClose?: () => void; variant?: "temporary" | "permanent" }) {
  const location = useLocation();
  const mode = (import.meta.env.MODE || "app").toUpperCase();
  
  const user = useMemo(getUser, []);
  const permSet = useMemo(() => new Set(user.permissions || []), [user.permissions]);
  const can = (p?: string) => !p || permSet.has(p);

  const groups = useMemo(
    () => GROUPS.map(g => {
        const items = g.items.filter(it => can(it.perm));
        return items.length ? { ...g, items } : null;
      }).filter(Boolean) as GroupItem[],
    [permSet]
  );

  const isActive = (to: string) => to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const content = (
    <Box
      sx={{
        width: drawerWidth, height: "100%", display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, #FFFAE6 0%, #FFFFFF 100%)`,
        borderRight: '1px solid rgba(0,0,0,0.06)'
      }}
    >
      <Toolbar sx={{ px: 2, py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <Box 
            component="img" src="/logo.png" alt="Logo"
            sx={{ 
                height: 80, width: 'auto', 
                filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                transition: 'transform 0.3s', '&:hover': { transform: 'scale(1.05) rotate(-2deg)' }
            }}
        />
        <Chip 
            size="small" label={mode === "PROD" ? "PRODUCTION" : "DEVELOPMENT"} 
            sx={{ bgcolor: mode === "PROD" ? "success.main" : "warning.main", color: '#fff', fontWeight: 800, fontSize: '0.65rem', height: 20 }} 
        />
      </Toolbar>

      <Divider sx={{ mx: 3, opacity: 0.1, borderColor: '#000' }} />

      <Box sx={{ flex: 1, overflowY: "auto", py: 2, px: 2 }}>
        <List component="nav" disablePadding>
          {groups.map(g => (
            <Box key={g.id} sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ px: 2, mb: 1, display: 'block', textTransform: 'uppercase', fontSize: '0.7rem', opacity: 0.7 }}>
                  {g.label}
              </Typography>
              {g.items.map(it => {
                  const active = isActive(it.to);
                  return (
                      <ListItemButton
                          key={it.to} component={Link} to={it.to} onClick={onClose}
                          sx={{
                              borderRadius: 3, mb: 0.5, py: 1.2, px: 2,
                              color: active ? 'primary.contrastText' : 'text.primary',
                              bgcolor: active ? 'primary.main' : 'transparent',
                              transition: 'all 0.2s',
                              '&:hover': { bgcolor: active ? 'primary.dark' : alpha('#FFB300', 0.1), transform: 'translateX(4px)' },
                              '& .MuiListItemIcon-root': { color: active ? 'primary.contrastText' : 'text.secondary', minWidth: 40 }
                          }}
                      >
                          <ListItemIcon>{it.icon}</ListItemIcon>
                          <ListItemText primary={it.label} primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: '0.9rem' }} />
                      </ListItemButton>
                  );
              })}
            </Box>
          ))}
        </List>
      </Box>

      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', opacity: 0.5 }}>
            🐯 CUSA Reunion Admin
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant} open={mobileOpen} onClose={onClose}
      sx={{ 
        display: { xs: variant === "temporary" ? "block" : "none", md: variant === "permanent" ? "block" : "none" },
        "& .MuiDrawer-paper": { width: drawerWidth, border: 'none' } 
      }}
    >
      {content}
    </Drawer>
  );
}
export const SIDE_WIDTH = drawerWidth;