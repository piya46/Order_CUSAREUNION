// src/components/SideNav.tsx
import { useMemo, useState, useEffect } from "react";
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Collapse, Toolbar, Typography, Divider, Chip, Stack, IconButton, Tooltip, Avatar, alpha
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
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import StoreIcon from "@mui/icons-material/Store"; // ✅ เพิ่มไอคอนร้านค้า

import { getUser } from "../lib/session";

const drawerWidth = 260;

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

const initials = (s?: string) =>
  (s || "?").replace(/\s+/g, " ").trim().split(" ").map(w => w[0]?.toUpperCase()).slice(0, 2).join("") || "?";

const stringToColor = (str = "x") => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 85% 45%)`;
};

type GroupItem = {
  label: string;
  icon?: React.ReactNode;
  items: { to: string; label: string; icon?: React.ReactNode; perm?: string }[];
  id: string;
};

const GROUPS: GroupItem[] = [
  {
    id: "ops",
    label: "Operations",
    icon: <DashboardIcon />,
    items: [
      { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
      { to: "/orders", label: "Orders", icon: <ReceiptLongIcon />, perm: "order:manage" },
      { to: "/products", label: "Products", icon: <Inventory2Icon />, perm: "product:manage" },
    ]
  },
  {
    id: "purchasing",
    label: "Purchasing",
    icon: <ShoppingCartIcon />,
    items: [
      { to: "/po", label: "Purchase Orders", icon: <ShoppingCartIcon />, perm: "po:manage" },
      { to: "/po/new", label: "Create PO", icon: <AddCircleOutlineIcon />, perm: "po:manage" },
      { to: "/receiving", label: "Receiving", icon: <MoveDownIcon />, perm: "receiving:manage" },
      { to: "/receiving/new", label: "Create Receiving", icon: <AddCircleOutlineIcon />, perm: "receiving:manage" },
      // ✅ เพิ่มเมนู Suppliers ตรงนี้
      { to: "/suppliers", label: "Suppliers (ผู้ขาย)", icon: <StoreIcon />, perm: "po:manage" }, 
    ]
  },
  {
    id: "support",
    label: "Support",
    icon: <ReportProblemIcon />,
    items: [
      { to: "/issues", label: "Issues", icon: <ReportProblemIcon />, perm: "issue:manage" },
    ]
  },
  {
    id: "admin",
    label: "Administration",
    icon: <SecurityIcon />,
    items: [
      { to: "/users", label: "Users", icon: <GroupIcon />, perm: "user:manage" },
      { to: "/roles", label: "Roles", icon: <SecurityIcon />, perm: "role:manage" },
      { to: "/audit", label: "Audit Logs", icon: <FactCheckIcon />, perm: "audit:manage" },
    ]
  },
];

export default function SideNav({
  mobileOpen, onClose, variant = "permanent"
}: { mobileOpen?: boolean; onClose?: () => void; variant?: "temporary" | "permanent" }) {
  const location = useLocation();
  const mode = (import.meta.env.MODE || "app").toUpperCase();
  const appName = import.meta.env.VITE_APP_NAME || "AdminWeb";

  const user = useMemo(getUser, []);
  const displayName = user.name || user.username || "Administrator";
  const avatarColor = stringToColor(displayName);
  const permSet = useMemo(() => new Set(user.permissions || []), [user.permissions]);
  const can = (p?: string) => !p || permSet.has(p);

  const groups = useMemo(
    () =>
      GROUPS.map(g => {
        const items = g.items.filter(it => can(it.perm));
        return items.length ? { ...g, items } : null;
      }).filter(Boolean) as GroupItem[],
    [permSet]
  );

  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("aw_sidenav_open") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    localStorage.setItem("aw_sidenav_open", JSON.stringify(openMap));
  }, [openMap]);
  const toggle = (id: string) => setOpenMap(s => ({ ...s, [id]: !s[id] }));

  const appVersion =
    (typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__) ||
    import.meta.env.VITE_APP_VERSION ||
    "dev";
  const buildTime =
    (typeof __BUILD_TIME__ !== "undefined" && __BUILD_TIME__) ||
    "";
  const buildTimeShort = buildTime ? new Date(buildTime).toLocaleString() : "";

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const content = (
    <Box
      sx={{
        width: drawerWidth,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: (t) =>
          `linear-gradient(180deg, ${alpha(t.palette.primary.main, .14)} 0%, transparent 24%),
           linear-gradient(135deg, ${alpha('#20C997', .18)} 0%, ${alpha('#2196F3', .18)} 100%)`,
        backdropFilter: "saturate(140%) blur(6px)"
      }}
    >
      <Toolbar
        sx={{
          px: 2,
          py: 1.25,
          background: (t) =>
            `linear-gradient(135deg, ${alpha('#20C997', .85)} 0%, ${alpha('#2196F3', .85)} 100%)`,
          color: "#fff",
          boxShadow: (t) => `inset 0 -1px 0 ${alpha('#fff', .18)}`
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: "100%" }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Avatar
              sx={{ width: 36, height: 36, fontWeight: 900, bgcolor: "#fff", color: avatarColor }}
            >
              {initials(displayName)}
            </Avatar>
            <Stack lineHeight={1.15}>
              <Typography variant="subtitle2" sx={{ opacity: .95, fontWeight: 800 }}>{appName}</Typography>
              <Typography variant="caption" sx={{ opacity: .8 }}>{displayName}</Typography>
            </Stack>
          </Stack>
          <Chip size="small" label={mode} color={mode === "PROD" ? "success" : "warning"} sx={{ color: "#fff", fontWeight: 700 }} />
        </Stack>
      </Toolbar>

      <Divider sx={{ opacity: .5 }} />

      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <List component="nav" sx={{ px: 1 }}>
          {groups.map(g => {
            const isOpen = openMap[g.id] ?? true;
            return (
              <Box key={g.id} sx={{ mb: .5 }}>
                <ListItemButton
                  onClick={() => toggle(g.id)}
                  sx={{
                    mx: .5, mb: .25, borderRadius: 2,
                    background: (t) => alpha(t.palette.background.paper, .6),
                    "&:hover": { background: (t) => alpha(t.palette.background.paper, .9) },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: "text.secondary" }}>{g.icon}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={900}>{g.label}</Typography>
                        <Chip size="small" label={g.items.length} sx={{ height: 18 }} />
                      </Stack>
                    }
                  />
                  {isOpen ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>

                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding sx={{ ml: 1.5, pl: 1 }}>
                    <Box
                      sx={{
                        position: "relative",
                        "&::before": {
                          content: '""',
                          position: "absolute", left: 14, top: 6, bottom: 6, width: 2,
                          bgcolor: (t) => alpha(t.palette.primary.main, .18), borderRadius: 1
                        }
                      }}
                    >
                      {g.items.map(it => {
                        const active = isActive(it.to);
                        return (
                          <ListItemButton
                            key={it.to}
                            component={Link}
                            to={it.to}
                            sx={{
                              my: .25, mx: .5, pl: 5.5, borderRadius: 2,
                              bgcolor: active ? (t) => alpha(t.palette.primary.main, .14) : "transparent",
                              color: active ? "primary.main" : "text.primary",
                            }}
                            onClick={onClose}
                          >
                            <ListItemIcon sx={{ minWidth: 28, color: active ? "primary.main" : "text.secondary" }}>
                              {it.icon}
                            </ListItemIcon>
                            <ListItemText primary={<Typography fontWeight={active ? 800 : 500}>{it.label}</Typography>} />
                          </ListItemButton>
                        );
                      })}
                    </Box>
                  </List>
                </Collapse>
              </Box>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ opacity: .6 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.25 }}>
        <Tooltip title={buildTimeShort ? `Build: ${buildTimeShort}` : ""}>
          <Typography variant="caption" color="text.secondary">v{appVersion}</Typography>
        </Tooltip>
        <Tooltip title="Collapse all (save state)">
          <IconButton aria-label="ยุบทั้งหมด" onClick={() => setOpenMap({})} size="small"><MenuOpenIcon fontSize="small" /></IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );

  if (variant === "temporary") {
    return (
      <Drawer
        open={!!mobileOpen}
        onClose={onClose}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        sx={{
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: (t) => `1px solid ${alpha(t.palette.divider, .6)}`
          }
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: "none", md: "block" },
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: (t) => `1px solid ${alpha(t.palette.divider, .6)}`
        }
      }}
      open
    >
      {content}
    </Drawer>
  );
}

export const SIDE_WIDTH = drawerWidth;