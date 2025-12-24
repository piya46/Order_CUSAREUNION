// src/pages/Tracking.jsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PersonIcon from "@mui/icons-material/Person";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import api from "../api/axios";

const formatBaht = (n) =>
  typeof n === "number" ? n.toLocaleString("th-TH") + " บาท" : "-";

export default function Tracking() {
  const [params] = useSearchParams();
  const orderIdParam = params.get("orderId") || "";
  const trackingParam = params.get("trackingNo") || ""; // query ยังรับชื่อเดิมได้

  const [order, setOrder] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [trackingNo, setTrackingNo] = useState(trackingParam);

  // ถ้ามี orderId ให้ดึงข้อมูลออเดอร์
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderIdParam) return;
      try {
        setLoadingOrder(true);
        const res = await api.get(`/orders/${orderIdParam}`);
        setOrder(res.data);
        // ✅ ใช้ field มาตรฐาน 'trackingNumber'
        if (res.data?.trackingNumber) setTrackingNo(res.data.trackingNumber);
      } catch (e) {
        // noop
      } finally {
        setLoadingOrder(false);
      }
    };
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderIdParam]);

  const thaiPostUrl = trackingNo
    ? `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(
        trackingNo.trim()
      )}`
    : "";

  const copyTracking = async () => {
    if (!trackingNo) return;
    try {
      await navigator.clipboard.writeText(trackingNo);
    } catch {
      // noop
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f5f7fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{ p: 3, borderRadius: 4, width: "100%", maxWidth: 720 }}
      >
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <LocalShippingIcon color="primary" />
          <Typography variant="h5" fontWeight={800}>
            ตรวจสอบสถานะพัสดุ
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          กรอกเลขพัสดุ หรือเปิดหน้านี้จากรายละเอียดออเดอร์เพื่อเติมให้อัตโนมัติ
        </Typography>

        {/* กล่องเลขพัสดุ + ปุ่มไปเว็บไปรษณีย์ไทย */}
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 3, bgcolor: "background.default", mb: 3 }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              fullWidth
              label="เลขพัสดุ (Tracking Number)"
              value={trackingNo}
              onChange={(e) => setTrackingNo(e.target.value)}
              size="small"
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={copyTracking}
                disabled={!trackingNo}
              >
                คัดลอก
              </Button>
              <Button
                variant="contained"
                startIcon={<OpenInNewIcon />}
                href={thaiPostUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                disabled={!trackingNo}
              >
                เปิดในไปรษณีย์ไทย
              </Button>
            </Stack>
          </Stack>
          {!trackingNo && (
            <Stack direction="row" alignItems="center" spacing={1} mt={1.5}>
              <SearchIcon fontSize="small" color="disabled" />
              <Typography variant="caption" color="text.secondary">
                ยังไม่มีเลขพัสดุ — กรอกด้านบนหรือกลับไปที่ออเดอร์เพื่อเช็คสถานะล่าสุด
              </Typography>
            </Stack>
          )}
        </Paper>

        {/* ข้อมูลออเดอร์ (ถ้ามี) */}
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          ข้อมูลการสั่งซื้อ
        </Typography>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
          {loadingOrder ? (
            <Typography color="text.secondary">กำลังโหลดข้อมูลออเดอร์…</Typography>
          ) : order ? (
            <>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "flex-start", sm: "center" }}
                justifyContent="space-between"
                spacing={1}
                mb={1}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <Inventory2Icon color="action" />
                  <Typography variant="subtitle1" fontWeight={700}>
                    ออเดอร์ #{order.orderNo || order._id}
                  </Typography>
                </Stack>
                <Chip
                  label={order.orderStatus || "—"}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              </Stack>

              <List dense disablePadding>
                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PersonIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="ชื่อลูกค้า"
                    secondary={order.customerName || "-"}
                  />
                </ListItem>

                {order.customerAddress && (
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <LocalShippingIcon color="action" />
                    </ListItemIcon>
                    <ListItemText
                      primary="ที่อยู่จัดส่ง"
                      secondary={order.customerAddress}
                    />
                  </ListItem>
                )}

                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <AttachMoneyIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="ยอดรวม"
                    secondary={formatBaht(Number(order.totalAmount || 0))}
                  />
                </ListItem>

                <ListItem disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <LocalShippingIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="เลขพัสดุ"
                    secondary={order.trackingNumber || trackingNo || "—"}
                  />
                </ListItem>
              </List>

              {Array.isArray(order.items) && order.items.length > 0 && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    รายการสินค้า ({order.items.length})
                  </Typography>
                  <Stack spacing={0.75}>
                    {order.items.slice(0, 4).map((it, idx) => (
                      <Typography
                        key={`${it.productId || idx}`}
                        variant="body2"
                        color="text.secondary"
                      >
                        • {it.name || it.productName || "สินค้า"} × {it.quantity ?? it.qty ?? 1}
                        {it.variant
                          ? ` (${it.variant.size || "-"} | ${it.variant.color || "-"})`
                          : ""}
                      </Typography>
                    ))}
                    {order.items.length > 4 && (
                      <Typography variant="caption" color="text.secondary">
                        + อีก {order.items.length - 4} รายการ
                      </Typography>
                    )}
                  </Stack>
                </>
              )}
            </>
          ) : (
            <Stack spacing={1}>
              <Typography color="text.secondary">
                ไม่มีข้อมูลออเดอร์ — คุณสามารถกรอกเลขพัสดุด้านบนเพื่อเปิดดูในระบบไปรษณีย์ไทยได้ทันที
              </Typography>
              <Typography variant="caption" color="text.disabled">
                หากต้องการตรวจสอบออเดอร์อื่น ๆ กรุณากลับไปที่หน้าหลักหรือหน้ารายการสั่งซื้อ
              </Typography>
            </Stack>
          )}
        </Paper>
      </Paper>
    </Box>
  );
}
