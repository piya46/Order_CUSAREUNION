// src/pages/Orders/OrdersList.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Paper, Typography, Table, TableHead, TableRow, TableCell, TableBody,
  Stack, Chip, TextField, MenuItem, Button, Divider, Tooltip,
  IconButton, Skeleton, alpha, Collapse, InputAdornment, Dialog, DialogTitle, Checkbox
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ChatIcon from "@mui/icons-material/Chat";
import FilterListIcon from "@mui/icons-material/FilterList";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SearchIcon from "@mui/icons-material/Search";
import DescriptionIcon from "@mui/icons-material/Description";
import { Link, useLocation } from "react-router-dom";
import * as XLSX from "xlsx"; // static import ป้องกันปัญหา optimize

const API = import.meta.env.VITE_API_URL || "/api";
function getToken() { return localStorage.getItem("aw_token") || ""; }
const fmtBaht = (n: number) => (n || 0).toLocaleString("th-TH") + " บาท";

type OrderItem = { productName: string; size?: string; color?: string; price: number; quantity: number };
type Order = {
  _id: string;
  orderNo: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  customerLineId?: string;
  items?: OrderItem[];
  totalAmount: number;
  paymentStatus: "WAITING" | "PENDING_PAYMENT" | "PAYMENT_CONFIRMED" | "REJECTED" | "EXPIRED";
  orderStatus: "RECEIVED" | "PREPARING_ORDER" | "SHIPPING" | "COMPLETED" | "CANCELLED";
  shippingType?: "DELIVERY" | "PICKUP_EVENT" | "PICKUP_SMAKHOM";
  trackingNumber?: string;
  slipReviewCount?: number;
  createdAt: string;
};

const payOpts = ["ALL","WAITING","PENDING_PAYMENT","PAYMENT_CONFIRMED","REJECTED","EXPIRED"] as const;
const ordOpts = ["ALL","RECEIVED","PREPARING_ORDER","SHIPPING","COMPLETED","CANCELLED"] as const;
const shipOpts = ["ALL","DELIVERY","PICKUP_SMAKHOM","PICKUP_EVENT"] as const;
const trackOpts = ["ALL","HAS","NONE"] as const;
const addrOpts = ["ALL","HAS","NONE"] as const;

const PAY_THAI: Record<Order["paymentStatus"], string> = {
  WAITING: "รอโอน/รอตรวจ",
  PENDING_PAYMENT: "รอตรวจสอบ",
  PAYMENT_CONFIRMED: "ชำระแล้ว",
  REJECTED: "สลิปไม่ผ่าน",
  EXPIRED: "หมดอายุ",
};
const payColor = (s: Order["paymentStatus"]) =>
  s === "PAYMENT_CONFIRMED" ? "success"
  : s === "REJECTED" ? "error"
  : s === "EXPIRED" ? "default"
  : "warning";

const ORDER_THAI: Record<Order["orderStatus"], string> = {
  RECEIVED: "รับออเดอร์",
  PREPARING_ORDER: "กำลังเตรียมสินค้า",
  SHIPPING: "กำลังจัดส่ง",
  COMPLETED: "เสร็จสมบูรณ์",
  CANCELLED: "ยกเลิก",
};
const orderColor = (s: Order["orderStatus"]) =>
  s === "COMPLETED" ? "success"
  : s === "CANCELLED" ? "default"
  : s === "SHIPPING" ? "info"
  : s === "PREPARING_ORDER" ? "primary"
  : "secondary";

// ===== CSV fallback helper =====
function downloadCSV(filename: string, rows: any[]) {
  if (!rows.length) rows = [{}];
  const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    "\uFEFF" + headers.join(","), // BOM + header
    ...rows.map(r => headers.map(h => esc((r as any)[h])).join(","))
  ].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/\.xlsx$/i, ".csv");
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function OrdersList() {
  const location = useLocation();

  const [rows, setRows] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);

  // ฟิลเตอร์พื้นฐาน
  const [q, setQ] = useState("");
  const [pay, setPay] = useState<(typeof payOpts)[number]>("ALL");
  const [ord, setOrd] = useState<(typeof ordOpts)[number]>("ALL");
  const [groupBy, setGroupBy] = useState<"none"|"pay"|"order">("none");

  // ฟิลเตอร์ขั้นสูง
  const [advOpen, setAdvOpen] = useState(false);
  const [ship, setShip] = useState<(typeof shipOpts)[number]>("ALL");
  const [track, setTrack] = useState<(typeof trackOpts)[number]>("ALL");
  const [addr, setAddr] = useState<(typeof addrOpts)[number]>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [minAmt, setMinAmt] = useState<number | "">("");
  const [maxAmt, setMaxAmt] = useState<number | "">("");
  const [productQ, setProductQ] = useState<string>("");

  // ส่งข้อความลูกค้า
  const [msgDlg, setMsgDlg] = useState<{ open: boolean; order?: Order }>({ open: false });
  const [msgText, setMsgText] = useState("");
  const [pushing, setPushing] = useState(false);

  // Bulk import tracking
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelect = (id: string) =>
    setSelectedIds(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const clearSelect = () => setSelectedIds([]);

  // query string quick tabs + initial filters
  const searchParams = new URLSearchParams(location.search);
  const tab = (searchParams.get("tab") || "").toLowerCase();
  const noTracking = searchParams.get("noTracking") === "1";

  // โหลดข้อมูล
  const refreshOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/orders`, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshOrders(); }, []);

  // อ่าน initial filters จาก URL + quick tabs
  useEffect(() => {
    if (tab === "waiting") { setPay("WAITING"); setOrd("ALL"); }
    else if (tab === "rejected") { setPay("REJECTED"); setOrd("ALL"); }
    else if (tab === "shipping") { setOrd("SHIPPING"); }
    else if (tab === "issue") { setPay("ALL"); setOrd("ALL"); }

    const get = (k: string) => searchParams.get(k) || "";
    const pq = get("q"); if (pq) setQ(pq);
    const ppay = get("pay"); if (payOpts.includes(ppay as any)) setPay(ppay as any);
    const pord = get("ord"); if (ordOpts.includes(pord as any)) setOrd(pord as any);
    const pship = get("ship"); if (shipOpts.includes(pship as any)) setShip(pship as any);
    const ptrk = get("track"); if (trackOpts.includes(ptrk as any)) setTrack(ptrk as any);
    const paddr = get("addr"); if (addrOpts.includes(paddr as any)) setAddr(paddr as any);
    const pf = get("from"); if (pf) setDateFrom(pf);
    const pt = get("to"); if (pt) setDateTo(pt);
    const pmin = get("min"); if (pmin) setMinAmt(Number(pmin));
    const pmax = get("max"); if (pmax) setMaxAmt(Number(pmax));
    const ppq = get("pq"); if (ppq) setProductQ(ppq);
    const pg = get("group"); if (["none","pay","order"].includes(pg)) setGroupBy(pg as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // sync ฟิลเตอร์ -> URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (pay!=="ALL") params.set("pay", pay);
    if (ord!=="ALL") params.set("ord", ord);
    if (ship!=="ALL") params.set("ship", ship);
    if (track!=="ALL") params.set("track", track);
    if (addr!=="ALL") params.set("addr", addr);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (minAmt!=="") params.set("min", String(minAmt));
    if (maxAmt!=="") params.set("max", String(maxAmt));
    if (productQ) params.set("pq", productQ);
    if (groupBy!=="none") params.set("group", groupBy);
    const s = params.toString();
    const url = s ? `?${s}` : "";
    if (url !== window.location.search) window.history.replaceState(null, "", url);
  }, [q,pay,ord,ship,track,addr,dateFrom,dateTo,minAmt,maxAmt,productQ,groupBy]);

  useEffect(() => {
    if (msgDlg.open && msgDlg.order) {
      setMsgText(`สวัสดี ${msgDlg.order.customerName} (เลขออเดอร์ ${msgDlg.order.orderNo})`);
    }
  }, [msgDlg.open, msgDlg.order]);

  const itemsToText = (items?: OrderItem[]) =>
    (items || [])
      .map(it => `${it.productName}${it.size ? ` (${it.size}${it.color ? `/${it.color}` : ""})` : ""} ×${it.quantity}`)
      .join(" ; ");

  const itemsCount = (items?: OrderItem[]) =>
    (items || []).reduce((s, it) => s + (it.quantity || 0), 0);

  const filtered = useMemo(() => {
    const list = rows || [];
    let result = list
      .filter(r => !q || r.orderNo?.toLowerCase().includes(q.toLowerCase()) || (r.customerName||"").toLowerCase().includes(q.toLowerCase()))
      .filter(r => !productQ || itemsToText(r.items).toLowerCase().includes(productQ.toLowerCase()))
      .filter(r => pay === "ALL" ? true : r.paymentStatus === pay)
      .filter(r => ord === "ALL" ? true : r.orderStatus === ord)
      .filter(r => {
        const st = (r.shippingType || "DELIVERY") as NonNullable<Order["shippingType"]>;
        return ship === "ALL" ? true : st === ship;
      })
      .filter(r => track === "ALL" ? true : track === "HAS" ? !!r.trackingNumber : !r.trackingNumber)
      .filter(r => {
        const hasAddr = !!(r.customerAddress && r.customerAddress.trim());
        return addr === "ALL" ? true : addr === "HAS" ? hasAddr : !hasAddr;
      })
      .filter(r => {
        const t = new Date(r.createdAt).getTime();
        const okFrom = dateFrom ? t >= new Date(`${dateFrom}T00:00:00`).getTime() : true;
        const okTo = dateTo ? t < new Date(`${dateTo}T23:59:59`).getTime() : true;
        return okFrom && okTo;
      })
      .filter(r => {
        const amt = r.totalAmount || 0;
        const okMin = minAmt === "" ? true : amt >= Number(minAmt);
        const okMax = maxAmt === "" ? true : amt <= Number(maxAmt);
        return okMin && okMax;
      });

    if (tab === "issue") {
      result = result.filter(r => (r.slipReviewCount || 0) >= 3 || r.paymentStatus === "REJECTED");
    }
    if (tab === "shipping" && noTracking) {
      result = result.filter(r => r.orderStatus === "SHIPPING" && !r.trackingNumber);
    }
    if (tab === "waiting") result = result.filter(r => r.paymentStatus === "WAITING");
    if (tab === "rejected") result = result.filter(r => r.paymentStatus === "REJECTED");

    return result.sort((a,b)=> +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [rows, q, productQ, pay, ord, ship, track, addr, dateFrom, dateTo, minAmt, maxAmt, tab, noTracking]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "ทั้งหมด", items: filtered }];
    const map = new Map<string, Order[]>();
    if (groupBy === "pay") {
      filtered.forEach(o => {
        const key = `ชำระเงิน: ${PAY_THAI[o.paymentStatus]}`;
        (map.get(key) || map.set(key, []).get(key)!).push(o);
      });
    } else {
      filtered.forEach(o => {
        const key = `ออเดอร์: ${ORDER_THAI[o.orderStatus]}`;
        (map.get(key) || map.set(key, []).get(key)!).push(o);
      });
    }
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  }, [filtered, groupBy]);

  const headerKpis = (() => {
    const total = filtered.length;
    const paid = filtered.filter(x => x.paymentStatus === "PAYMENT_CONFIRMED").length;
    const shipping = filtered.filter(x => x.orderStatus === "SHIPPING").length;
    const cancelled = filtered.filter(x => x.orderStatus === "CANCELLED").length;
    return { total, paid, shipping, cancelled };
  })();

  const copyAddr = async (o: Order) => {
    const lines = [
      `เลขออเดอร์: ${o.orderNo}`,
      `ชื่อลูกค้า: ${o.customerName}`,
      o.customerPhone ? `โทร: ${o.customerPhone}` : "",
      `ที่อยู่: ${o.customerAddress || "-"}`,
    ].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(lines); alert("คัดลอกที่อยู่แล้ว"); }
    catch { alert("ไม่สามารถคัดลอกได้"); }
  };

  // ====== เทมเพลตนำเข้าเลขพัสดุ ======
  const downloadTrackingTemplate = () => {
    const headers = ["orderNo", "trackingNumber"];
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Template (มีแต่ header)
      const wsTemplate = XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");

      // Sheet 2: Example (ตัวอย่าง 3 แถว)
      const wsExample = XLSX.utils.json_to_sheet([
        { orderNo: "AW-0001", trackingNumber: "TH1234567890" },
        { orderNo: "AW-0002", trackingNumber: "KEX0987654321" },
        { orderNo: "AW-0003", trackingNumber: "FLASH55667788" },
      ], { header: headers });
      XLSX.utils.book_append_sheet(wb, wsExample, "Example");

      // Sheet 3: README (คำแนะนำสั้น ๆ)
      const wsReadme = XLSX.utils.aoa_to_sheet([
        ["วิธีใช้"],
        ["1) เปิดชีต Template แล้วกรอกข้อมูลตามคอลัมน์"],
        ["2) บันทึกเป็น .xlsx หรือส่งออก .csv ก็ได้"],
        ["3) อัปโหลดไฟล์ผ่านปุ่ม 'นำเข้าเลขพัสดุ' ในหน้ารายการออเดอร์"],
        [],
        ["หมายเหตุ: ต้องมีหัวคอลัมน์ orderNo และ trackingNumber เท่านั้น"]
      ]);
      XLSX.utils.book_append_sheet(wb, wsReadme, "README");

      XLSX.writeFile(wb, "tracking_import_template.xlsx");
    } catch {
      // Fallback: ดาวน์โหลดเป็น CSV (มีแต่ header)
      downloadCSV("tracking_import_template.xlsx", [{ orderNo: "", trackingNumber: "" }]);
    }
  };

  // ===== ส่งออก “ยอดขายที่ชำระแล้ว” =====
  const exportSalesPaid = () => {
    const paid = filtered.filter(o => o.paymentStatus === "PAYMENT_CONFIRMED");
    const rows = paid.map(o => ({
      "วันที่ซื้อ": new Date(o.createdAt).toLocaleString("th-TH"),
      "เลขออเดอร์": o.orderNo,
      "ลูกค้า": o.customerName || "",
      "เบอร์โทร": o.customerPhone || "",
      "ช่องทางรับสินค้า": (o.shippingType || "DELIVERY") === "DELIVERY" ? "จัดส่ง" : (o.shippingType === "PICKUP_SMAKHOM" ? "รับที่สมาคม" : "รับหน้างาน"),
      "สถานะออเดอร์": ORDER_THAI[o.orderStatus],
      "ยอดรวม(บาท)": o.totalAmount || 0,
      "จำนวนรวมชิ้น": itemsCount(o.items),
      "รายการสินค้า": itemsToText(o.items),
      "เลขพัสดุ": o.trackingNumber || "",
    }));
    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SalesPaid");
      XLSX.writeFile(wb, `sales_paid_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch {
      downloadCSV(`sales_paid_${new Date().toISOString().slice(0,10)}.xlsx`, rows);
    }
  };

  // ===== ส่งออก “แยกรายการสินค้า/แถวละ 1 ชิ้น” =====
  const exportItemsExploded = () => {
    const paid = filtered.filter(o => o.paymentStatus === "PAYMENT_CONFIRMED");
    const rows = paid.flatMap(o =>
      (o.items || []).map(it => ({
        "วันที่ซื้อ": new Date(o.createdAt).toLocaleString("th-TH"),
        "เลขออเดอร์": o.orderNo,
        "ลูกค้า": o.customerName || "",
        "สินค้า": it.productName,
        "ตัวเลือก": [it.size, it.color].filter(Boolean).join("/"),
        "ราคา/ชิ้น": it.price || 0,
        "จำนวน": it.quantity || 0,
        "ยอดรวมรายการ": (it.price || 0) * (it.quantity || 0),
        "ช่องทางรับสินค้า": (o.shippingType || "DELIVERY") === "DELIVERY" ? "จัดส่ง" : (o.shippingType === "PICKUP_SMAKHOM" ? "รับที่สมาคม" : "รับหน้างาน"),
      }))
    );
    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Items");
      XLSX.writeFile(wb, `sales_items_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch {
      downloadCSV(`sales_items_${new Date().toISOString().slice(0,10)}.xlsx`, rows);
    }
  };

  // ===== ส่งออกที่อยู่ (ไฟล์เดียว 3 ชีต + Summary) =====
  const exportAddressesThreeSheets = () => {
    const ok = (o: Order) =>
      o.paymentStatus === "PAYMENT_CONFIRMED" &&
      o.orderStatus !== "CANCELLED";
    const deliv = filtered.filter(o => ok(o) && (o.shippingType || "DELIVERY") === "DELIVERY" && (o.customerAddress && o.customerAddress.trim()));
    const smakhom = filtered.filter(o => ok(o) && o.shippingType === "PICKUP_SMAKHOM");
    const event = filtered.filter(o => ok(o) && o.shippingType === "PICKUP_EVENT");

    const colDelivery = deliv.map(o => ({
      "วันที่ซื้อ": new Date(o.createdAt).toLocaleDateString("th-TH"),
      "เลขออเดอร์": o.orderNo,
      "ชื่อลูกค้า": o.customerName || "",
      "เบอร์โทร": o.customerPhone || "",
      "ที่อยู่จัดส่ง": o.customerAddress || "",
      "ยอดรวม(บาท)": o.totalAmount || 0,
      "จำนวนรวมชิ้น": itemsCount(o.items),
      "รายการสินค้า": itemsToText(o.items),
    }));
    const colSMA = smakhom.map(o => ({
      "วันที่ซื้อ": new Date(o.createdAt).toLocaleDateString("th-TH"),
      "เลขออเดอร์": o.orderNo,
      "ชื่อลูกค้า": o.customerName || "",
      "เบอร์โทร": o.customerPhone || "",
      "จุดรับ": "สมาคมนิสิตเก่าวิทยาศาสตร์",
      "หมายเหตุ/ข้อมูล": "ลูกค้านำเลขออเดอร์และบัตรประชาชนมาแสดง",
      "ยอดรวม(บาท)": o.totalAmount || 0,
      "จำนวนรวมชิ้น": itemsCount(o.items),
      "รายการสินค้า": itemsToText(o.items),
    }));
    const colEvent = event.map(o => ({
      "วันที่ซื้อ": new Date(o.createdAt).toLocaleDateString("th-TH"),
      "เลขออเดอร์": o.orderNo,
      "ชื่อลูกค้า": o.customerName || "",
      "เบอร์โทร": o.customerPhone || "",
      "จุดรับ": "รับหน้างาน",
      "หมายเหตุ/ข้อมูล": o.customerAddress || "ดูประกาศ/ข้อความแจ้งเวลา-สถานที่",
      "ยอดรวม(บาท)": o.totalAmount || 0,
      "จำนวนรวมชิ้น": itemsCount(o.items),
      "รายการสินค้า": itemsToText(o.items),
    }));

    const summary = {
      "จำนวนรายการ (ทั้งหมด)": filtered.length,
      "ยอดชำระแล้วรวม (บาท)": filtered
        .filter(o=>o.paymentStatus==="PAYMENT_CONFIRMED")
        .reduce((s,o)=>s+(o.totalAmount||0),0),
      "จำนวน Delivery": filtered.filter(o=>(o.shippingType||"DELIVERY")==="DELIVERY").length,
      "จำนวน รับที่สมาคม": filtered.filter(o=>o.shippingType==="PICKUP_SMAKHOM").length,
      "จำนวน รับหน้างาน": filtered.filter(o=>o.shippingType==="PICKUP_EVENT").length,
    };

    try {
      const wb = XLSX.utils.book_new();

      const mkSheet = (rows: any[], name: string, headers: string[]) => {
        const data = rows.length ? rows : [Object.fromEntries(headers.map(h => [h, ""]))];
        const ws = XLSX.utils.json_to_sheet(data, { header: headers });
        XLSX.utils.book_append_sheet(wb, ws, name);
      };

      mkSheet(colDelivery, "จัดส่ง (Delivery)", [
        "วันที่ซื้อ","เลขออเดอร์","ชื่อลูกค้า","เบอร์โทร","ที่อยู่จัดส่ง","ยอดรวม(บาท)","จำนวนรวมชิ้น","รายการสินค้า"
      ]);
      mkSheet(colSMA, "รับที่สมาคม", [
        "วันที่ซื้อ","เลขออเดอร์","ชื่อลูกค้า","เบอร์โทร","จุดรับ","หมายเหตุ/ข้อมูล","ยอดรวม(บาท)","จำนวนรวมชิ้น","รายการสินค้า"
      ]);
      mkSheet(colEvent, "รับหน้างาน", [
        "วันที่ซื้อ","เลขออเดอร์","ชื่อลูกค้า","เบอร์โทร","จุดรับ","หมายเหตุ/ข้อมูล","ยอดรวม(บาท)","จำนวนรวมชิ้น","รายการสินค้า"
      ]);

      const wsSum = XLSX.utils.json_to_sheet(
        Object.entries(summary).map(([Metric, Value]) => ({ Metric, Value }))
      );
      XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

      XLSX.writeFile(wb, `addresses_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch {
      downloadCSV(`addresses_${new Date().toISOString().slice(0,10)}.xlsx`, colDelivery);
    }
  };

  // ===== Export เฉพาะที่เลือก (paid) =====
  const exportSelectedPaid = () => {
    const setSel = new Set(selectedIds);
    const paid = filtered.filter(o => setSel.has(o._id) && o.paymentStatus==="PAYMENT_CONFIRMED");
    if (!paid.length) return alert("ยังไม่ได้เลือกรายการ หรือไม่มีออร์เดอร์ที่ชำระแล้ว");
    const rows = paid.map(o => ({
      "วันที่ซื้อ": new Date(o.createdAt).toLocaleString("th-TH"),
      "เลขออเดอร์": o.orderNo,
      "ลูกค้า": o.customerName || "",
      "ยอดรวม(บาท)": o.totalAmount || 0,
      "สินค้า": itemsToText(o.items),
    }));
    try {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "SelectedPaid");
      XLSX.writeFile(wb, `selected_paid_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch {
      downloadCSV(`selected_paid_${new Date().toISOString().slice(0,10)}.xlsx`, rows);
    }
  };

  // ส่งข้อความ
  const openMsgDialog = (o: Order) => setMsgDlg({ open: true, order: o });
  const sendMessage = async () => {
    if (!msgDlg.order) return;
    setPushing(true);
    try {
      const res = await fetch(`${API}/orders/${msgDlg.order._id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ text: msgText, message: msgText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ส่งข้อความไม่สำเร็จ");
      alert("ส่งข้อความแล้ว");
      setMsgDlg({ open: false });
    } catch (e: any) {
      alert(e?.message || "ส่งข้อความไม่สำเร็จ");
    } finally {
      setPushing(false);
    }
  };

  const shippableDelivery = useMemo(
    () => filtered.filter(o =>
      o.paymentStatus === "PAYMENT_CONFIRMED" &&
      (o.shippingType ?? "DELIVERY") === "DELIVERY" &&
      (o.customerAddress && o.customerAddress.trim()) &&
      o.orderStatus !== "CANCELLED"
    ),
    [filtered]
  );

  const resetAdv = () => {
    setShip("ALL"); setTrack("ALL"); setAddr("ALL");
    setDateFrom(""); setDateTo("");
    setMinAmt(""); setMaxAmt("");
    setProductQ("");
  };

  return (
    <Box p={{ xs: 2, md: 3 }}>
      {/* Header */}
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }} mb={2} spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <Typography variant="h5" fontWeight={900}>คำสั่งซื้อ</Typography>
          <Chip label={`ทั้งหมด ${headerKpis.total.toLocaleString()}`} color="primary" size="small" />
          <Chip label={`ชำระแล้ว ${headerKpis.paid.toLocaleString()}`} color="success" size="small" />
          <Chip label={`กำลังจัดส่ง ${headerKpis.shipping.toLocaleString()}`} color="info" size="small" />
          <Chip label={`ยกเลิก ${headerKpis.cancelled.toLocaleString()}`} size="small" />
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Tooltip title="ส่งออกเฉพาะรายการที่ชำระเงินสำเร็จ (ตามตัวกรองปัจจุบัน)">
            <Button onClick={exportSalesPaid} variant="outlined" startIcon={<FileDownloadIcon />}>ส่งออกยอดขาย (ชำระแล้ว)</Button>
          </Tooltip>
          <Tooltip title="ส่งออกแบบแตกแถวตามสินค้า (ชำระแล้วเท่านั้น)">
            <Button onClick={exportItemsExploded} variant="outlined" startIcon={<FileDownloadIcon />}>
              ส่งออก (แยกรายการ)
            </Button>
          </Tooltip>
          <Tooltip title="สร้างไฟล์ Excel เดียวมี 3 ชีต: จัดส่ง / รับที่สมาคม / รับหน้างาน (เฉพาะชำระแล้ว)">
            <span>
              <Button
                onClick={exportAddressesThreeSheets}
                variant="contained"
                startIcon={<FileDownloadIcon />}
                disabled={!filtered.some(o => o.paymentStatus === "PAYMENT_CONFIRMED")}
              >
                ส่งออกที่อยู่ (3 ชีต)
              </Button>
            </span>
          </Tooltip>

          {/* ปุ่มเทมเพลต + ปุ่มนำเข้าเลขพัสดุ */}
          <Tooltip title="ดาวน์โหลดเทมเพลต .xlsx สำหรับกรอก orderNo, trackingNumber">
            <Button
              onClick={downloadTrackingTemplate}
              variant="text"
              startIcon={<DescriptionIcon />}
            >
              เทมเพลตนำเข้า
            </Button>
          </Tooltip>
          <Tooltip title="เลือกไฟล์ .xlsx หรือ .csv ที่สร้างจากเทมเพลตนี้ (คอลัมน์: orderNo, trackingNumber)">
            <Button
              onClick={()=>fileInputRef.current?.click()}
              variant="text"
              startIcon={<CloudUploadIcon />}
              disabled={uploading}
            >
              นำเข้าเลขพัสดุ
            </Button>
          </Tooltip>
          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const buf = await file.arrayBuffer();
                let rows: any[] = [];
                if (file.name.toLowerCase().endsWith(".csv")) {
                  const text = new TextDecoder("utf-8").decode(buf);
                  rows = text.split(/\r?\n/).slice(1).map(l => l.split(","))
                    .filter(a=>a.length>=2).map(a => ({
                      orderNo: a[0]?.replace(/^"|"$/g,""),
                      trackingNumber: a[1]?.replace(/^"|"$/g,"")
                    }));
                } else {
                  const wb = XLSX.read(buf);
                  const ws = wb.Sheets[wb.SheetNames[0]];
                  rows = XLSX.utils.sheet_to_json(ws); // ต้องมีหัวคอลัมน์ orderNo, trackingNumber
                }
                const payload = rows
                  .map((r:any)=>({ orderNo: (r.orderNo||"").trim(), trackingNumber: (r.trackingNumber||"").trim() }))
                  .filter((r:any)=>r.orderNo && r.trackingNumber);

                if (!payload.length) { alert("ไม่พบข้อมูลที่ถูกต้อง (ต้องมีคอลัมน์ orderNo, trackingNumber)"); return; }

                const res = await fetch(`${API}/orders/bulk-tracking`, {
                  method: "POST",
                  headers: { "Content-Type":"application/json", Authorization: `Bearer ${getToken()}` },
                  body: JSON.stringify({ items: payload })
                });
                const data = await res.json().catch(()=> ({}));
                if (!res.ok) throw new Error(data?.error || "อัปเดตเลขพัสดุไม่สำเร็จ");
                alert(`อัปเดตเลขพัสดุแล้ว ${payload.length} รายการ`);
                await refreshOrders();
                clearSelect();
              } catch (err:any) {
                alert(err?.message || "นำเข้าเลขพัสดุไม่สำเร็จ");
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />

          <Tooltip title="ส่งออกเฉพาะออร์เดอร์ที่เลือก (เฉพาะชำระแล้ว)">
            <span>
              <Button
                onClick={exportSelectedPaid}
                variant="text"
                startIcon={<FileDownloadIcon />}
                disabled={!selectedIds.length}
              >
                ส่งออกที่เลือก
              </Button>
            </span>
          </Tooltip>

          <Button component={Link} to="/" size="small" startIcon={<AssessmentIcon />}>← กลับ Dashboard</Button>
        </Stack>
      </Stack>

      {/* Filters – basic */}
      <Paper variant="outlined" sx={{ p: 2, mb: 1.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs:"stretch", md:"center" }} flexWrap="wrap">
          <TextField
            size="small"
            label="ค้นหา (เลขออเดอร์/ชื่อลูกค้า)"
            value={q}
            onChange={e => setQ(e.target.value)}
            sx={{ minWidth: 260 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          />
          <TextField size="small" select label="ชำระเงิน" value={pay} onChange={(e)=>setPay(e.target.value as any)} sx={{ minWidth: 200 }}>
            {payOpts.map(x => <MenuItem key={x} value={x}>{x === "ALL" ? "ทั้งหมด" : PAY_THAI[x as Order["paymentStatus"]]}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="สถานะออเดอร์" value={ord} onChange={(e)=>setOrd(e.target.value as any)} sx={{ minWidth: 220 }}>
            {ordOpts.map(x => <MenuItem key={x} value={x}>{x === "ALL" ? "ทั้งหมด" : ORDER_THAI[x as Order["orderStatus"]]}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="จัดกลุ่ม" value={groupBy} onChange={(e)=>setGroupBy(e.target.value as any)} sx={{ minWidth: 180 }}>
            <MenuItem value="none">ไม่จัดกลุ่ม</MenuItem>
            <MenuItem value="pay">ตามชำระเงิน</MenuItem>
            <MenuItem value="order">ตามสถานะออเดอร์</MenuItem>
          </TextField>

          <Box flex={1} />
          <Button
            size="small"
            startIcon={<FilterListIcon />}
            onClick={()=>setAdvOpen(v=>!v)}
            variant="text"
          >
            ฟิลเตอร์ขั้นสูง {advOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </Button>
        </Stack>

        {/* Advanced filters */}
        <Collapse in={advOpen} unmountOnExit>
          <Divider sx={{ my: 1.25 }} />
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25} flexWrap="wrap">
            <TextField size="small" select label="ช่องทางรับสินค้า" value={ship} onChange={e=>setShip(e.target.value as any)} sx={{ minWidth: 220 }}>
              {shipOpts.map(x => <MenuItem key={x} value={x}>{x==="ALL" ? "ทั้งหมด" : (x==="DELIVERY"?"จัดส่ง":"PICKUP_SMAKHOM"===x?"รับที่สมาคม":"รับหน้างาน")}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="เลขพัสดุ" value={track} onChange={e=>setTrack(e.target.value as any)} sx={{ minWidth: 160 }}>
              <MenuItem value="ALL">ทั้งหมด</MenuItem>
              <MenuItem value="HAS">มีเลข</MenuItem>
              <MenuItem value="NONE">ไม่มีเลข</MenuItem>
            </TextField>
            <TextField size="small" select label="ที่อยู่จัดส่ง" value={addr} onChange={e=>setAddr(e.target.value as any)} sx={{ minWidth: 180 }}>
              <MenuItem value="ALL">ทั้งหมด</MenuItem>
              <MenuItem value="HAS">มีที่อยู่</MenuItem>
              <MenuItem value="NONE">ไม่มีที่อยู่</MenuItem>
            </TextField>
            <TextField size="small" type="date" label="จากวันที่" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
            <TextField size="small" type="date" label="ถึงวันที่" InputLabelProps={{ shrink: true }} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            <TextField size="small" type="number" label="ยอดขั้นต่ำ" value={minAmt} onChange={e=>setMinAmt(e.target.value === "" ? "" : Number(e.target.value))} />
            <TextField size="small" type="number" label="ยอดขั้นสูง" value={maxAmt} onChange={e=>setMaxAmt(e.target.value === "" ? "" : Number(e.target.value))} />
            <TextField
              size="small"
              label="ค้นหาสินค้า (ชื่อ/ตัวเลือก)"
              value={productQ}
              onChange={e=>setProductQ(e.target.value)}
              sx={{ minWidth: 280 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Box flex={1} />
            <Button size="small" onClick={resetAdv}>ล้างฟิลเตอร์ขั้นสูง</Button>
          </Stack>
        </Collapse>
      </Paper>

      {/* Table */}
      {loading ? (
        <Stack spacing={1.5}>
          {Array.from({ length: 5 }).map((_,i)=> <Skeleton key={i} variant="rounded" height={64} />)}
        </Stack>
      ) : (
        grouped.map(group => (
          <Paper key={group.key} variant="outlined" sx={{ mb: 2, overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1, bgcolor: (t)=>alpha(t.palette.primary.main,.06), borderBottom: (t)=>`1px solid ${alpha(t.palette.primary.main,.12)}` }}>
              <Typography fontWeight={800}>{group.key} <Typography component="span" color="text.secondary">({group.items.length.toLocaleString()} รายการ)</Typography></Typography>
            </Box>
            <Box sx={{ p: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">เลือก</TableCell>
                    <TableCell>เลขออเดอร์</TableCell>
                    <TableCell>ลูกค้า</TableCell>
                    <TableCell>สินค้า</TableCell>
                    <TableCell align="right">ยอดรวม</TableCell>
                    <TableCell>ชำระเงิน</TableCell>
                    <TableCell>ออเดอร์</TableCell>
                    <TableCell>รับสินค้า/เลขพัสดุ</TableCell>
                    <TableCell>สร้างเมื่อ</TableCell>
                    <TableCell align="center">การทำงาน</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {group.items.map((o) => {
                    const canContact = !!(o.customerLineId || o.customerPhone);
                    const shipLabel = (o.shippingType || "DELIVERY") === "DELIVERY" ? "จัดส่ง"
                      : (o.shippingType === "PICKUP_SMAKHOM" ? "รับที่สมาคม" : "รับหน้างาน");

                    return (
                      <TableRow key={o._id} hover>
                        <TableCell padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={selectedIds.includes(o._id)}
                            onChange={()=>toggleSelect(o._id)}
                          />
                        </TableCell>
                        <TableCell><Typography fontWeight={800}>{o.orderNo}</Typography></TableCell>
                        <TableCell>
                          <Stack spacing={.25}>
                            <Typography>{o.customerName}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {o.customerPhone || "-"}{o.customerLineId ? ` • LINE ID: ${o.customerLineId}` : ""}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{itemsToText(o.items)}</Typography>
                        </TableCell>
                        <TableCell align="right">{fmtBaht(o.totalAmount)}</TableCell>
                        <TableCell><Chip label={PAY_THAI[o.paymentStatus]} color={payColor(o.paymentStatus)} size="small" /></TableCell>
                        <TableCell><Chip label={ORDER_THAI[o.orderStatus]} color={orderColor(o.orderStatus)} size="small" /></TableCell>
                        <TableCell>
                          <Typography variant="body2">{shipLabel}{o.trackingNumber ? ` • ${o.trackingNumber}` : ""}</Typography>
                        </TableCell>
                        <TableCell>{new Date(o.createdAt).toLocaleString("th-TH")}</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                          <Tooltip title="คัดลอกที่อยู่จัดส่ง">
                            <span>
                              <IconButton size="small" onClick={() => copyAddr(o)} disabled={!o.customerAddress}>
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={canContact ? "ส่งข้อความหาลูกค้า" : "ไม่มีข้อมูลติดต่อ"}>
                            <span>
                              <IconButton size="small" onClick={() => openMsgDialog(o)} disabled={!canContact}>
                                <ChatIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Button size="small" component={Link} to={`/orders/${o._id}`} variant="outlined" sx={{ ml: 1 }}>
                            ดู
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        ))
      )}

      {/* Info bar */}
      <Paper sx={{ p: 1, mt: 1, borderRadius: 2, display: "inline-block", bgcolor: (t)=>alpha(t.palette.primary.main,.06) }}>
        <Chip
          variant="outlined"
          label={`พร้อมจัดส่ง (Delivery + ชำระแล้ว + มีที่อยู่): ${shippableDelivery.length.toLocaleString()} รายการ`}
          size="small"
          color={shippableDelivery.length ? "success" : "default"}
        />
        {!!selectedIds.length && (
          <Chip
            sx={{ ml: 1 }}
            variant="outlined"
            label={`เลือกแล้ว: ${selectedIds.length}`}
            size="small"
            onDelete={clearSelect}
          />
        )}
      </Paper>

      {/* Dialog ส่งข้อความหาลูกค้า */}
      <Dialog open={msgDlg.open} onClose={()=>setMsgDlg({ open:false })} fullWidth maxWidth="sm">
        <DialogTitle>ส่งข้อความหาลูกค้า</DialogTitle>
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
            ถึง: <b>{msgDlg.order?.customerName}</b> {msgDlg.order?.customerPhone ? `• ${msgDlg.order.customerPhone}` : ""} {msgDlg.order?.customerLineId ? `• LINE ID: ${msgDlg.order.customerLineId}` : ""}
          </Typography>
        </Box>
        <Box sx={{ px: 3 }}>
          <TextField
            label="ข้อความ"
            value={msgText}
            onChange={e=>setMsgText(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            placeholder="พิมพ์ข้อความที่จะส่งถึงลูกค้า..."
          />
        </Box>
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
          <Button onClick={()=>setMsgDlg({ open:false })}>ยกเลิก</Button>
          <Button variant="contained" onClick={sendMessage} disabled={pushing || !msgText.trim()}>
            {pushing ? "กำลังส่ง..." : "ส่งข้อความ"}
          </Button>
        </Stack>
      </Dialog>
    </Box>
  );
}