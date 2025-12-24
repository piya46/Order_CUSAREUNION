import { Box, Typography, Button, Stack } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 3,
      }}
    >
      <Stack spacing={2} alignItems="center">
        <ErrorOutlineIcon sx={{ fontSize: 80, color: "error.main" }} />
        <Typography variant="h2" fontWeight={700} color="error.main">
          404
        </Typography>
        <Typography variant="h6" color="text.secondary">
          ไม่พบหน้าที่คุณต้องการ
        </Typography>
        <Button
          component={Link}
          to="/"
          variant="contained"
          sx={{
            borderRadius: 2,
            px: 4,
            py: 1,
            textTransform: "none",
            fontWeight: 600,
          }}
        >
          กลับหน้าแรก
        </Button>
      </Stack>
    </Box>
  );
}