// src/pages/Me.jsx
import { useContext, useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Stack,
  Button,
  Alert,
  Divider,
  Chip,
  Snackbar,
} from "@mui/material";

import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShieldIcon from "@mui/icons-material/Shield";
import GppBadIcon from "@mui/icons-material/GppBad";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";

import {
  isProfileCacheAllowed,
  setProfileCacheAllowed,
  getSavedProfile,
  saveProfile,
  clearProfile,
} from "../utils/profileCache";

import { LiffContext } from "../context/LiffContext";

export default function Me() {
  // ===== LINE profile =====
  const { profile } = useContext(LiffContext);
  const lineName =
    [profile?.displayName]?.filter(Boolean).join(" ").trim() || "-";

  // ===== Local cache switches & form =====
  const [allow, setAllow] = useState(isProfileCacheAllowed());
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    address: "",
  });
  const [toast, setToast] = useState("");

  // โหลด/รีเซ็ตค่าฟอร์มตาม allow
  useEffect(() => {
    if (allow) {
      const p = getSavedProfile();
      setForm({
        firstName: p.firstName || "",
        lastName: p.lastName || "",
        phone: p.phone || "",
        address: p.address || "",
      });
    } else {
      // ปิดการบันทึก -> ล้างค่าที่บันทึกทิ้งทันที
      clearProfile();
      setForm({ firstName: "", lastName: "", phone: "", address: "" });
    }
  }, [allow]);

  // ปุ่มสลับเปิด/ปิดการบันทึก
  const toggleAllow = () => {
    const next = !allow;
    setAllow(next);
    setProfileCacheAllowed(next);
    if (!next) {
      clearProfile();
      setToast("ปิดการบันทึกและล้างข้อมูลเรียบร้อย");
    } else {
      setToast("เปิดการบันทึกในเครื่อง");
    }
  };

  const onSave = () => {
    saveProfile(form);
    setToast("บันทึกข้อมูลแล้ว");
  };
  const onClear = () => {
    clearProfile();
    setForm({ firstName: "", lastName: "", phone: "", address: "" });
    setToast("ล้างข้อมูลแล้ว");
  };

  // ฟอร์แมตเบอร์มือถือขณะพิมพ์ (0xx-xxx-xxxx)
  const onPhoneChange = (v) => {
    const digits = String(v).replace(/\D+/g, "").slice(0, 10);
    const f =
      digits.length > 6
        ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
        : digits.length > 3
        ? `${digits.slice(0, 3)}-${digits.slice(3)}`
        : digits;
    setForm((s) => ({ ...s, phone: f }));
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(form.address || "");
      setToast("คัดลอกที่อยู่แล้ว");
    } catch {}
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        p: { xs: 1.5, md: 3 },
        background:
          "radial-gradient(1200px 600px at 5% -10%, rgba(245,158,11,.10), transparent 60%)," +
          "radial-gradient(1200px 600px at 95% 110%, rgba(251,191,36,.12), transparent 60%), #FFFEF5",
        pb: 10,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          maxWidth: 900,
          mx: "auto",
          borderRadius: 3,
          border: "1px solid #FFE5A3",
          background: "#fff",
        }}
      >
        {/* ส่วนหัว: แสดงเฉพาะชื่อจาก LINE */}
        <Stack spacing={0.5} alignItems="flex-start" mb={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AssignmentIndIcon color="primary" />
            <Typography variant="h6" fontWeight={900}>
              ข้อมูลจาก LINE
            </Typography>
          </Stack>
          <Typography>
            ชื่อใน LINE: <b>{lineName}</b>
          </Typography>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* คำเตือนเมื่อปิดการบันทึก */}
        {!allow && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mb: 2, borderRadius: 2 }}
          >
            ฟีเจอร์นี้จะบันทึกข้อมูลไว้ในอุปกรณ์ของคุณเท่านั้น (Local
            Storage) อาจหายได้เมื่อเคลียร์แคช/ใช้เครื่องอื่น
            และมีความเสี่ยงด้านความเป็นส่วนตัว โปรดใช้ด้วยความระมัดระวัง
          </Alert>
        )}

        {/* ปุ่มสลับเปิด/ปิด (ชัดเจนสำหรับผู้สูงอายุ) */}
        <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
          <Chip
            size="small"
            label="บันทึกในอุปกรณ์ (Local Cache)"
            variant="outlined"
          />
          <Button
            onClick={toggleAllow}
            variant="contained"
            color={allow ? "success" : "warning"}
            startIcon={allow ? <ShieldIcon /> : <GppBadIcon />}
            sx={{ fontWeight: 900, borderRadius: 2 }}
          >
            {allow ? "กำลังบันทึก: เปิดอยู่" : "ไม่บันทึก: ปิดอยู่"}
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* ฟอร์มจะ “แสดงเฉพาะเมื่อเปิด” เท่านั้น */}
        {allow ? (
          <>
            <Stack spacing={1.25}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                <TextField
                  label="ชื่อ"
                  fullWidth
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                  inputProps={{ autoCapitalize: "words" }}
                />
                <TextField
                  label="นามสกุล"
                  fullWidth
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                  inputProps={{ autoCapitalize: "words" }}
                />
              </Stack>

              <TextField
                label="เบอร์โทรศัพท์"
                fullWidth
                value={form.phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="0xx-xxx-xxxx"
                inputProps={{ inputMode: "numeric", pattern: "[0-9-]*" }}
                helperText="ใช้เฉพาะตัวเลข ระบบจะช่วยจัดรูปแบบให้อัตโนมัติ"
              />

              <TextField
                label="ที่อยู่สำหรับจัดส่ง (ถ้ามี)"
                fullWidth
                multiline
                minRows={3}
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                helperText="สามารถคัดลอกไปวางตอนสั่งซื้อได้ทันที"
              />

              <Stack direction="row" spacing={1}>
                <Button
                  startIcon={<ContentCopyIcon />}
                  variant="outlined"
                  onClick={copyAddress}
                  disabled={!form.address}
                >
                  คัดลอกที่อยู่
                </Button>
              </Stack>
            </Stack>

            <Stack
              direction="row"
              spacing={1.25}
              justifyContent="flex-end"
              sx={{ mt: 2 }}
            >
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                onClick={onClear}
              >
                ล้างข้อมูลที่บันทึก
              </Button>
              <Button
                variant="contained"
                color="warning"
                startIcon={<SaveIcon />}
                onClick={onSave}
              >
                บันทึก
              </Button>
            </Stack>
          </>
        ) : (
          // เมื่อปิด: ซ่อนฟอร์มทั้งหมด
          <Typography color="text.secondary">
            ขณะนี้ระบบ{" "}
            <b>“ไม่บันทึกข้อมูลลงอุปกรณ์”</b> หากต้องการให้แบบฟอร์มแสดงผล
            กรุณากดปุ่มด้านบนเพื่อเปิดการบันทึก
          </Typography>
        )}
      </Paper>

      <Snackbar
        open={!!toast}
        onClose={() => setToast("")}
        autoHideDuration={1400}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}