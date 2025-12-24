const PDFDocument = require('pdfkit');
const excel = require('exceljs');
const path = require('path');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIG: ข้อมูลบริษัท (ผู้ซื้อ) แก้ไขตรงนี้ครับ
// ==========================================
const COMPANY_INFO = {
  name: "บริษัท ตัวอย่าง จำกัด (สำนักงานใหญ่)",
  nameEn: "EXAMPLE COMPANY CO., LTD.",
  address: "123/45 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310",
  taxId: "010555XXXXXXX",
  phone: "02-123-4567",
  email: "purchase@example.com",
  logo: "logo_placeholder.png"
};

// ==========================================
// 🔧 HELPERS
// ==========================================
const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
const boldFontPath = path.join(__dirname, '../fonts/THSarabunNew Bold.ttf'); // ถ้ามีตัวหนา
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
// 1. Export Purchase Order (PO) -> PDF (สวยงาม)
// ==========================================
exports.exportPOtoPDF = (po, res) => {
  try {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Handle Stream Error
    doc.on('error', (err) => { console.error("PDF Error:", err); });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.poNumber}.pdf"`);
    doc.pipe(res);

    // ---------------------------------------------------------
    // 1. HEADER & COMPANY INFO (ผู้ซื้อ)
    // ---------------------------------------------------------
    const logoPath = path.join(__dirname, `../public/uploads/${COMPANY_INFO.logo}`);
    
    // Logo (ซ้ายบน)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 60 });
    }

    // Company Details (ซ้าย ถัดจากโลโก้)
    const headerLeftX = fs.existsSync(logoPath) ? 110 : 40;
    
    setFont(doc, 18, true); // ตัวหนา
    doc.text(COMPANY_INFO.name, headerLeftX, 40);
    
    setFont(doc, 10);
    doc.text(COMPANY_INFO.nameEn, headerLeftX, 58);
    doc.text(COMPANY_INFO.address, headerLeftX, 70);
    doc.text(`เลขประจำตัวผู้เสียภาษี: ${COMPANY_INFO.taxId}`, headerLeftX, 82);
    doc.text(`Tel: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`, headerLeftX, 94);

    // Document Title (ขวาบน)
    setFont(doc, 24, true);
    doc.text('ใบสั่งซื้อ', 0, 40, { align: 'right' });
    setFont(doc, 14);
    doc.text('PURCHASE ORDER', 0, 65, { align: 'right' });

    // PO Number Box (ขวาบน ใต้ชื่อเอกสาร)
    const boxTop = 85;
    const boxLeft = 400;
    doc.rect(boxLeft, boxTop, 155, 55).strokeColor('#333').stroke();
    
    setFont(doc, 11, true);
    doc.text('เลขที่ใบสั่งซื้อ (PO No.):', boxLeft + 5, boxTop + 5);
    setFont(doc, 12, true);
    doc.text(po.poNumber, boxLeft + 5, boxTop + 20, { align: 'right', width: 145 }); // ชิดขวาในกล่อง
    
    setFont(doc, 11, true);
    doc.text('วันที่ (Date):', boxLeft + 5, boxTop + 35);
    setFont(doc, 12);
    doc.text(formatDate(po.orderDate), boxLeft + 60, boxTop + 35, { align: 'right', width: 90 });

    // ---------------------------------------------------------
    // 2. VENDOR INFO (ผู้ขาย) - กรอบแยกชัดเจน
    // ---------------------------------------------------------
    doc.moveDown();
    const vendorY = 150;
    
    // วาดพื้นหลังหัวข้อ Vendor
    doc.fillColor('#eee').rect(40, vendorY, 515, 20).fill();
    doc.fillColor('#000'); // กลับมาสีดำ

    setFont(doc, 12, true);
    doc.text('ผู้จำหน่าย (VENDOR / SUPPLIER)', 45, vendorY + 4);

    // ข้อมูล Vendor
    setFont(doc, 12);
    const vendorInfoY = vendorY + 25;
    
    doc.text('ชื่อผู้ขาย:', 45, vendorInfoY);
    setFont(doc, 14, true); 
    doc.text(po.supplierName || '-', 100, vendorInfoY - 2); // ชื่อเด่นๆ

    setFont(doc, 12);
    doc.text('ผู้ติดต่อ:', 45, vendorInfoY + 20);
    doc.text(po.supplierContact || '-', 100, vendorInfoY + 20);

    doc.text('หมายเหตุ:', 300, vendorInfoY);
    doc.text(po.note || '-', 350, vendorInfoY, { width: 200 });

    // ---------------------------------------------------------
    // 3. TABLE HEADER (หัวตารางสวยงาม)
    // ---------------------------------------------------------
    let y = 220;
    const col = { no: 40, product: 80, spec: 230, qty: 350, price: 410, total: 480 };
    const colW = { no: 30, product: 140, spec: 110, qty: 50, price: 60, total: 75 };

    // Header Background
    doc.fillColor('#2c3e50').rect(40, y, 515, 25).fill(); // สีน้ำเงินเข้ม
    doc.fillColor('#fff'); // ตัวหนังสือสีขาว

    setFont(doc, 12, true);
    const headY = y + 7;
    doc.text('#', col.no, headY, { width: colW.no, align: 'center' });
    doc.text('รายการสินค้า (Description)', col.product, headY);
    doc.text('รายละเอียด (Spec)', col.spec, headY);
    doc.text('จำนวน', col.qty, headY, { width: colW.qty, align: 'right' });
    doc.text('ราคา/หน่วย', col.price, headY, { width: colW.price, align: 'right' });
    doc.text('รวมเงิน', col.total, headY, { width: colW.total, align: 'right' });

    doc.fillColor('#000'); // กลับมาสีดำสำหรับเนื้อหา
    y += 25;

    // ---------------------------------------------------------
    // 4. TABLE ITEMS (รายการสินค้า)
    // ---------------------------------------------------------
    setFont(doc, 11);

    if (po.items && po.items.length > 0) {
      po.items.forEach((item, index) => {
        // ขึ้นหน้าใหม่ถ้าพื้นที่ไม่พอ
        if (y > 700) {
          doc.addPage();
          y = 40;
          // วาดหัวตารางซ้ำ (Optional)
        }

        // Zebra Striping (สีสลับบรรทัด)
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

    // ---------------------------------------------------------
    // 5. SUMMARY FOOTER (สรุปยอด)
    // ---------------------------------------------------------
    y += 10;
    const summaryX = 350;
    const summaryValX = 450;
    
    // ยอดรวม
    setFont(doc, 12, true);
    doc.text('ยอดรวมสุทธิ (Grand Total):', summaryX, y + 5, { width: 100, align: 'right' });
    
    setFont(doc, 14, true);
    doc.fillColor('#000');
    doc.text(formatCurrency(po.totalAmount), summaryValX, y + 3, { width: 105, align: 'right' });
    
    // เส้นใต้คู่ที่ยอดเงิน
    const lineY = y + 22;
    doc.moveTo(summaryValX, lineY).lineTo(555, lineY).stroke();
    doc.moveTo(summaryValX, lineY + 3).lineTo(555, lineY + 3).stroke();


    // ---------------------------------------------------------
    // 6. SIGNATURE (ลายเซ็น)
    // ---------------------------------------------------------
    let signY = y + 60;
    if (signY > 700) { doc.addPage(); signY = 100; }

    const boxW = 200;
    const leftSignX = 60;
    const rightSignX = 340;

    // กรอบลายเซ็นผู้จัดทำ
    setFont(doc, 11);
    doc.text('_____________________________', leftSignX, signY, { align: 'center', width: boxW });
    doc.text('ผู้จัดทำ (Prepared By)', leftSignX, signY + 15, { align: 'center', width: boxW });
    doc.text(`วันที่: ${formatDate(new Date())}`, leftSignX, signY + 30, { align: 'center', width: boxW });

    // กรอบลายเซ็นผู้อนุมัติ
    doc.text('_____________________________', rightSignX, signY, { align: 'center', width: boxW });
    doc.text('ผู้อนุมัติ (Approved By)', rightSignX, signY + 15, { align: 'center', width: boxW });
    doc.text('วันที่: ______/______/______', rightSignX, signY + 30, { align: 'center', width: boxW });

    doc.end();

  } catch (err) {
    console.error("Export PDF Error:", err);
    if (!res.headersSent) res.status(500).send("Error generating PDF");
  }
};

// ... (ส่วน exportReceivingToPDF, exportPOtoExcel, exportReceivingToExcel ใช้ของเดิม หรือจะให้ผมแก้ให้ด้วยบอกได้ครับ)
// ... เพื่อความชัวร์ ผมจะใส่ exportReceivingToPDF แบบปรับปรุงให้ด้วยครับ เพื่อให้ Theme เดียวกัน

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
  
      setFont(doc, 18, true);
      const hX = fs.existsSync(logoPath) ? 110 : 40;
      doc.text(COMPANY_INFO.name, hX, 40);
      setFont(doc, 10);
      doc.text('ใบรับสินค้าเข้าคลัง (RECEIVING REPORT)', hX, 60);
  
      // Info Box
      const boxTop = 90;
      doc.fillColor('#f5f5f5').rect(40, boxTop, 515, 60).fill();
      doc.fillColor('#000');
  
      setFont(doc, 12);
      doc.text(`เลขที่เอกสาร: ${receiving.receivingNumber}`, 50, boxTop + 10);
      doc.text(`อ้างอิง PO: ${receiving.po ? receiving.po.poNumber : '-'}`, 50, boxTop + 30);
      
      doc.text(`ผู้รับของ: ${receiving.receiverName}`, 300, boxTop + 10);
      doc.text(`วันที่รับ: ${formatDate(receiving.receiveDate)}`, 300, boxTop + 30);
  
      // Table
      let y = 170;
      doc.fillColor('#27ae60').rect(40, y, 515, 25).fill(); // สีเขียว
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
  
      // Sign
      const signY = y + 50 > 700 ? 700 : y + 50;
      if (signY === 700 && y > 650) doc.addPage();
      
      setFont(doc, 11);
      doc.text('_______________________', 400, signY, { align: 'center', width: 150 });
      doc.text(`ผู้รับของ (${receiving.receiverName})`, 400, signY + 15, { align: 'center', width: 150 });
  
      doc.end();
  
    } catch (err) { console.error(err); res.end(); }
};

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