import {
  Box,
  Typography,
  Paper,
  Stack,
  Button,
  Divider,
  Chip,
} from "@mui/material";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

export default function OnlyInLine() {
  const handleOpenLine = () => {
    // พยายามเปิดแอป LINE
    window.location.href = "line://";
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("คัดลอกลิงก์แล้ว! เปิดผ่านเมนูใน LINE ได้เลย");
    } catch {
      alert("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        p: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // พื้นหลังไล่เฉดนุ่ม ๆ
        background:
          "linear-gradient(135deg, #e8f5e9 0%, #f5f7fa 40%, #eef7ff 100%)",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: "100%",
          maxWidth: 460,
          borderRadius: 4,
          p: { xs: 3, md: 4 },
          textAlign: "center",
        }}
      >
        {/* วงกลมไอคอน */}
        <Box
          sx={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            mx: "auto",
            mb: 2,
            display: "grid",
            placeItems: "center",
            backgroundColor: "rgba(7,193,96,0.1)", // โทน LINE
          }}
        >
          <ChatBubbleOutlineIcon sx={{ fontSize: 42, color: "#07C160" }} />
        </Box>

        <Typography variant="h5" fontWeight={800} gutterBottom>
          เปิดได้เฉพาะในแอป LINE เท่านั้น
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          กรุณาปิดหน้านี้ และเข้าผ่าน <b>เมนูภายใน LINE</b> เพื่อใช้งานต่อ
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          sx={{ my: 1 }}
        >
          <Chip label="ปลอดภัย" color="success" variant="outlined" />
          <Chip label="เข้าถึงง่าย" variant="outlined" />
          <Chip label="แนะนำ" variant="outlined" />
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Stack spacing={1.5}>
          <Button
            variant="contained"
            size="large"
            onClick={handleOpenLine}
            startIcon={<OpenInNewIcon />}
            sx={{
              bgcolor: "#07C160",
              "&:hover": { bgcolor: "#05a752" },
              borderRadius: 2,
              py: 1.2,
              fontWeight: 700,
            }}
          >
            เปิดในแอป LINE
          </Button>

          <Button
            variant="outlined"
            onClick={handleCopy}
            startIcon={<ContentCopyIcon />}
            sx={{ borderRadius: 2, py: 1.1, fontWeight: 700 }}
          >
            คัดลอกลิงก์นี้ไว้เปิดใน LINE
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: "block" }}>
          เคล็ดลับ: หากปุ่มไม่ทำงาน ให้เปิดแอป LINE ก่อน แล้วเข้าผ่านเมนูที่ร้านส่งให้
        </Typography>
      </Paper>
    </Box>
  );
}