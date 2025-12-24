// src/pages/Forbidden.tsx
import { Box, Typography, Button } from "@mui/material";
import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight={900}>403: ไม่มีสิทธิ์เข้าถึง</Typography>
      <Typography color="text.secondary" sx={{ mt: .5 }}>
        โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์ หรือกลับหน้าแรก
      </Typography>
      <Button sx={{ mt: 2 }} variant="contained" component={Link} to="/">กลับหน้าแรก</Button>
    </Box>
  );
}