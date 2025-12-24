const PDFDocument = require('pdfkit');
const excel = require('exceljs');
const path = require('path');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIG: ข้อมูลบริษัท (ผู้ซื้อ)
// ==========================================
const COMPANY_INFO = {
  name: "สมาคมนิสิตเก่าวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย",
  nameEn: "-",
  address: "254 ถ.พญาไท แขวงวังใหม่ เขตปทุมวัน กรุงเทพฯ 10330",
  taxId: "-",
  phone: "-",
  email: "-",
  logo: "logo_placeholder.png" // ต้องมีไฟล์นี้ใน backend/public/uploads/ หรือใส่ path รูปที่มีจริง
};

// ==========================================
// 🔧 HELPERS
// ==========================================
// เช็คฟอนต์ภาษาไทย (สำคัญมากต้องมีไฟล์ THSarabunNew.ttf)
const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
const boldFontPath = path.join(__dirname, '../fonts/THSarabunNew Bold.ttf');
const hasThaiFont = fs.existsSync(fontPath);
const hasBoldFont = fs.existsSync(boldFontPath);

const setFont = (doc, size = 14, isBold = false) => {
  if (isBold && hasBoldFont) {
    doc.font(boldFontPath).fontSize(size);
  } else if (hasThaiFont) {
    doc.font(fontPath).fontSize(size);
  } else {
    doc.font('Helvetica').fontSize(size);
  }
};

const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
};

const formatDate = (date) => {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('th-TH', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch (e) { return '-'; }
};

// ==========================================
// 1. Export Purchase Order (PO) -> PDF
// ==========================================
exports.exportPOtoPDF = (po, res) => {
  try {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    doc.on('error', (err) => { console.error("PDF Error:", err); });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.poNumber}.pdf"`);
    doc.pipe(res);

    // --- Header ---
    const logoPath = path.join(__dirname, `../public/uploads/${COMPANY_INFO.logo}`);
    // เช็คว่ามีรูปหรือไม่ก่อนโหลด
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 60 });
    }

    const headerLeftX = fs.existsSync(logoPath) ? 110 : 40;
    
    // Company Info
    setFont(doc, 18, true);
    doc.text(COMPANY_INFO.name, headerLeftX, 40);
    
    setFont(doc, 10);
    doc.text(COMPANY_INFO.nameEn, headerLeftX, 58);
    doc.text(COMPANY_INFO.address, headerLeftX, 70);
    doc.text(`Tax ID: ${COMPANY_INFO.taxId}`, headerLeftX, 82);
    doc.text(`Tel: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`, headerLeftX, 94);

    // Document Title (Right Side)
    setFont(doc, 24, true);
    doc.text('ใบสั่งซื้อ', 0, 40, { align: 'right' });
    setFont(doc, 14);
    doc.text('PURCHASE ORDER', 0, 65, { align: 'right' });

    // PO Info Box
    const boxTop = 85;
    const boxLeft = 380;
    const boxWidth = 175;
    
    // วาดกรอบสี่เหลี่ยมโค้งมน
    doc.roundedRect(boxLeft, boxTop, boxWidth, 55, 5).strokeColor('#333').stroke();
    
    setFont(doc, 11, true);
    doc.text('เลขที่ใบสั่งซื้อ (PO No.):', boxLeft + 10, boxTop + 8);
    setFont(doc, 14, true);
    doc.text(po.poNumber, boxLeft + 10, boxTop + 20, { align: 'right', width: boxWidth - 20 });
    
    setFont(doc, 11, true);
    doc.text('วันที่ (Date):', boxLeft + 10, boxTop + 38);
    setFont(doc, 12);
    doc.text(formatDate(po.orderDate), boxLeft + 80, boxTop + 38, { align: 'right', width: boxWidth - 90 });

    // --- Vendor Section ---
    doc.moveDown();
    const vendorY = 150;
    
    // แถบหัวข้อ
    doc.fillColor('#eee').rect(40, vendorY, 515, 20).fill();
    doc.fillColor('#000');

    setFont(doc, 12, true);
    doc.text('ผู้จำหน่าย (VENDOR / SUPPLIER)', 45, vendorY + 4);

    // ข้อมูลผู้ขาย
    const vendorInfoY = vendorY + 25;
    setFont(doc, 12);
    doc.text('ชื่อผู้ขาย:', 45, vendorInfoY);
    setFont(doc, 14, true); 
    doc.text(po.supplierName || '-', 100, vendorInfoY - 2); 

    setFont(doc, 12);
    doc.text('ผู้ติดต่อ:', 45, vendorInfoY + 20);
    doc.text(po.supplierContact || '-', 100, vendorInfoY + 20);

    doc.text('หมายเหตุ:', 300, vendorInfoY);
    doc.text(po.note || '-', 350, vendorInfoY, { width: 200 });

    // --- Table Header ---
    let y = 220;
    const col = { no: 40, product: 80, spec: 230, qty: 350, price: 410, total: 480 };
    const colW = { no: 30, product: 140, spec: 110, qty: 50, price: 60, total: 75 };

    // Header Background (Navy Blue)
    doc.fillColor('#2c3e50').rect(40, y, 515, 25).fill();
    doc.fillColor('#fff'); 

    setFont(doc, 12, true);
    const headY = y + 7;
    doc.text('#', col.no, headY, { width: colW.no, align: 'center' });
    doc.text('รายการสินค้า (Description)', col.product, headY);
    doc.text('รายละเอียด (Spec)', col.spec, headY);
    doc.text('จำนวน', col.qty, headY, { width: colW.qty, align: 'right' });
    doc.text('ราคา/หน่วย', col.price, headY, { width: colW.price, align: 'right' });
    doc.text('รวมเงิน', col.total, headY, { width: colW.total, align: 'right' });

    doc.fillColor('#000');
    y += 25;

    // --- Table Items ---
    setFont(doc, 11);

    if (po.items && po.items.length > 0) {
      po.items.forEach((item, index) => {
        // ขึ้นหน้าใหม่ถ้าพื้นที่ไม่พอ
        if (y > 700) {
          doc.addPage();
          y = 40;
        }

        // Zebra Striping
        if (index % 2 === 0) {
          doc.fillColor('#f9f9f9').rect(40, y, 515, 20).fill();
          doc.fillColor('#000');
        }

        const productName = item.product?.name || item.productName || '-';
        const spec = `${item.size ? 'Size: '+item.size : ''} ${item.color ? 'Color: '+item.color : ''}`.trim();
        const lineTotal = (item.quantity || 0) * (item.price || 0);

        const rowY = y + 5;
        doc.text(index + 1, col.no, rowY, { width: colW.no, align: 'center' });
        doc.text(productName, col.product, rowY, { width: colW.product });
        doc.text(spec, col.spec, rowY, { width: colW.spec });
        doc.text(item.quantity, col.qty, rowY, { width: colW.qty, align: 'right' });
        doc.text(formatCurrency(item.price), col.price, rowY, { width: colW.price, align: 'right' });
        doc.text(formatCurrency(lineTotal), col.total, rowY, { width: colW.total, align: 'right' });

        y += 20;
      });
    }

    // เส้นปิดท้ายตาราง
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#ccc').stroke();

    // --- Footer Summary ---
    y += 10;
    const summaryX = 350;
    const summaryValX = 450;
    
    setFont(doc, 12, true);
    doc.text('ยอดรวมสุทธิ (Grand Total):', summaryX, y + 5, { width: 100, align: 'right' });
    
    setFont(doc, 14, true);
    doc.text(formatCurrency(po.totalAmount), summaryValX, y + 3, { width: 105, align: 'right' });
    
    // เส้นใต้คู่
    const lineY = y + 22;
    doc.moveTo(summaryValX, lineY).lineTo(555, lineY).stroke();
    doc.moveTo(summaryValX, lineY + 3).lineTo(555, lineY + 3).stroke();

    // --- Signatures ---
    let signY = y + 60;
    if (signY > 700) { doc.addPage(); signY = 100; }

    const boxW = 200;
    const leftSignX = 60;
    const rightSignX = 340;

    setFont(doc, 11);
    // Left Signature
    doc.text('_____________________________', leftSignX, signY, { align: 'center', width: boxW });
    doc.text('ผู้จัดทำ (Prepared By)', leftSignX, signY + 15, { align: 'center', width: boxW });
    doc.text(`วันที่: ${formatDate(new Date())}`, leftSignX, signY + 30, { align: 'center', width: boxW });

    // Right Signature
    doc.text('_____________________________', rightSignX, signY, { align: 'center', width: boxW });
    doc.text('ผู้อนุมัติ (Approved By)', rightSignX, signY + 15, { align: 'center', width: boxW });
    doc.text('วันที่: ______/______/______', rightSignX, signY + 30, { align: 'center', width: boxW });

    doc.end();

  } catch (err) {
    console.error("Export PDF Error:", err);
    if (!res.headersSent) res.status(500).send("Error generating PDF");
  }
};

// ==========================================
// 2. Export Receiving (RC) -> PDF
// ==========================================
exports.exportReceivingToPDF = (receiving, res) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.on('error', (err) => console.error(err));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="RC_${receiving.receivingNumber}.pdf"`);
      doc.pipe(res);
  
      // Header
      const logoPath = path.join(__dirname, `../public/uploads/${COMPANY_INFO.logo}`);
      if (fs.existsSync(logoPath)) doc.image(logoPath, 40, 40, { width: 60 });
  
      const hX = fs.existsSync(logoPath) ? 110 : 40;
      setFont(doc, 18, true);
      doc.text(COMPANY_INFO.name, hX, 40);
      setFont(doc, 10);
      doc.text('ใบรับสินค้าเข้าคลัง (RECEIVING REPORT)', hX, 60);
  
      // Info Box (สีเทาอ่อน)
      const boxTop = 90;
      doc.fillColor('#f5f5f5').roundedRect(40, boxTop, 515, 60, 5).fill();
      doc.fillColor('#000');
  
      setFont(doc, 12);
      doc.text(`เลขที่เอกสาร: ${receiving.receivingNumber}`, 50, boxTop + 10);
      doc.text(`อ้างอิง PO: ${receiving.po ? receiving.po.poNumber : '-'}`, 50, boxTop + 30);
      
      doc.text(`ผู้รับของ: ${receiving.receiverName}`, 300, boxTop + 10);
      doc.text(`วันที่รับ: ${formatDate(receiving.receiveDate)}`, 300, boxTop + 30);
  
      // Table Header (Green)
      let y = 170;
      doc.fillColor('#27ae60').rect(40, y, 515, 25).fill();
      doc.fillColor('#fff');
  
      setFont(doc, 12, true);
      doc.text('#', 40, y + 7, { width: 40, align: 'center' });
      doc.text('สินค้า', 90, y + 7);
      doc.text('Variant', 300, y + 7);
      doc.text('จำนวนรับ', 450, y + 7, { width: 100, align: 'right' });
  
      doc.fillColor('#000');
      y += 25;
      setFont(doc, 11);
  
      if (receiving.items) {
          receiving.items.forEach((item, idx) => {
              if (y > 700) { doc.addPage(); y = 40; }
              if (idx % 2 === 0) { doc.fillColor('#f9f9f9').rect(40, y, 515, 20).fill(); doc.fillColor('#000'); }
              
              const pName = item.product?.name || 'Unknown';
              const vName = `${item.size||''} ${item.color||''}`;
  
              doc.text(idx + 1, 40, y + 5, { width: 40, align: 'center' });
              doc.text(pName, 90, y + 5);
              doc.text(vName, 300, y + 5);
              doc.text(item.quantity, 450, y + 5, { width: 100, align: 'right' });
              y += 20;
          });
      }
  
      // Signature
      const signY = y + 50 > 700 ? 700 : y + 50;
      if (signY === 700 && y > 650) doc.addPage();
      
      setFont(doc, 11);
      doc.text('_______________________', 400, signY, { align: 'center', width: 150 });
      doc.text(`ผู้รับของ (${receiving.receiverName})`, 400, signY + 15, { align: 'center', width: 150 });
  
      doc.end();
  
    } catch (err) { console.error(err); res.end(); }
};

// ==========================================
// 3. Export PO -> Excel
// ==========================================
exports.exportPOtoExcel = async (po, res) => {
  try {
    const wb = new excel.Workbook();
    const ws = wb.addWorksheet('Purchase Order');

    const borderStyle = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

    // Header Info
    ws.addRow([COMPANY_INFO.name]);
    ws.mergeCells('A1:G1');
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.addRow(['ใบสั่งซื้อ / PURCHASE ORDER']).font = { bold: true, size: 12 };
    ws.addRow(['PO Number', po.poNumber]);
    ws.addRow(['Vendor', po.supplierName]);
    ws.addRow(['Contact', po.supplierContact]);
    ws.addRow(['Date', formatDate(po.orderDate)]);
    ws.addRow(['Status', po.status]);
    ws.addRow([]); 

    // Table Headers
    const headerRow = ws.addRow(['#', 'Product Name', 'Size', 'Color', 'Quantity', 'Unit Price', 'Total']);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2c3e50' } };
        cell.alignment = { horizontal: 'center' };
    });

    if (po.items) {
        po.items.forEach((item, idx) => {
            const row = ws.addRow([
              idx + 1,
              item.product?.name || item.productName || 'Unknown',
              item.size || '-',
              item.color || '-',
              item.quantity,
              item.price,
              (item.quantity || 0) * (item.price || 0)
            ]);
            row.eachCell({ includeEmpty: true }, (cell) => { cell.border = borderStyle; });
        });
    }

    ws.addRow([]);
    const totalRow = ws.addRow(['', '', '', '', '', 'Grand Total', po.totalAmount]);
    totalRow.getCell(6).font = { bold: true };
    totalRow.getCell(7).font = { bold: true, color: { argb: 'FF0000' } };
    totalRow.getCell(7).numFmt = '#,##0.00';

    ws.getColumn(2).width = 40;
    ws.getColumn(6).width = 15;
    ws.getColumn(7).width = 20;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.poNumber}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export Excel Error:", err);
    res.status(500).send("Error exporting Excel");
  }
};

// ==========================================
// 4. Export Receiving -> Excel
// ==========================================
exports.exportReceivingToExcel = async (receiving, res) => {
  try {
    const wb = new excel.Workbook();
    const ws = wb.addWorksheet('Receiving');

    ws.addRow(['RECEIVING NOTE']).font = { bold: true, size: 16 };
    ws.addRow(['Doc No', receiving.receivingNumber]);
    ws.addRow(['PO Ref', receiving.po ? receiving.po.poNumber : '-']);
    ws.addRow(['Receiver', receiving.receiverName]);
    ws.addRow(['Date', formatDate(receiving.receiveDate)]);
    ws.addRow([]);

    const headerRow = ws.addRow(['#', 'Product Name', 'Size', 'Color', 'Quantity Received']);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '27ae60' } };
    });

    if (receiving.items) {
        receiving.items.forEach((item, idx) => {
            ws.addRow([
              idx + 1,
              item.product?.name || 'Unknown',
              item.size || '-',
              item.color || '-',
              item.quantity
            ]);
        });
    }

    ws.getColumn(2).width = 40;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="RC_${receiving.receivingNumber}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export Excel Error:", err);
    res.status(500).send("Error exporting Excel");
  }
};