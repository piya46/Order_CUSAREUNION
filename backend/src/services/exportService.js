const PDFDocument = require('pdfkit');
const excel = require('exceljs');
const path = require('path');
const fs = require('fs');

// ==========================================
// ⚙️ CONFIG: ข้อมูลบริษัท (ผู้ซื้อ)
// ==========================================
const COMPANY_INFO = {
  name: "สมาคมนิสิตเก่าวิทยาศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย",
  nameEn: "Science Alumni Association, Chulalongkorn University", 
  address: "254 ถ.พญาไท แขวงวังใหม่ เขตปทุมวัน กรุงเทพฯ 10330",
  taxId: "-", 
  phone: "-",
  email: "-",
  logo: "logo_placeholder.png" 
};

// ==========================================
// 🔧 HELPERS
// ==========================================
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

    // --- 1. Header Section ---
    const logoPath = path.join(__dirname, `../public/uploads/${COMPANY_INFO.logo}`);
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 60 });
    }

    const headerLeftX = fs.existsSync(logoPath) ? 110 : 40;
    
    // Company Name
    setFont(doc, 18, true);
    doc.text(COMPANY_INFO.name, headerLeftX, 40);
    
    // Company Details
    setFont(doc, 10);
    doc.text(COMPANY_INFO.nameEn, headerLeftX, 58);
    doc.text(COMPANY_INFO.address, headerLeftX, 70);
    doc.text(`เลขประจำตัวผู้เสียภาษี: ${COMPANY_INFO.taxId}`, headerLeftX, 82);
    doc.text(`โทร: ${COMPANY_INFO.phone} | อีเมล: ${COMPANY_INFO.email}`, headerLeftX, 94);

    // Document Title (Right Side)
    setFont(doc, 26, true);
    doc.text('ใบสั่งซื้อ', 0, 40, { align: 'right' });
    setFont(doc, 14);
    doc.text('PURCHASE ORDER', 0, 65, { align: 'right' });

    // PO Info Box
    const boxTop = 85;
    const boxLeft = 380;
    const boxWidth = 175;
    
    doc.roundedRect(boxLeft, boxTop, boxWidth, 55, 5).strokeColor('#333').stroke();
    
    setFont(doc, 11, true);
    doc.text('เลขที่ใบสั่งซื้อ (PO No.):', boxLeft + 10, boxTop + 8);
    setFont(doc, 14, true);
    doc.text(po.poNumber, boxLeft + 10, boxTop + 20, { align: 'right', width: boxWidth - 20 });
    
    setFont(doc, 11, true);
    doc.text('วันที่ (Date):', boxLeft + 10, boxTop + 38);
    setFont(doc, 12);
    doc.text(formatDate(po.orderDate), boxLeft + 80, boxTop + 38, { align: 'right', width: boxWidth - 90 });

    // --- 2. Vendor Section (ปรับปรุงใหม่) ---
    doc.moveDown();
    const vendorY = 155;
    
    doc.fillColor('#f0f0f0').rect(40, vendorY, 515, 20).fill();
    doc.fillColor('#000');

    setFont(doc, 12, true);
    doc.text('ข้อมูลผู้จำหน่าย (VENDOR / SUPPLIER)', 45, vendorY + 4);

    // 🔴 แก้ไขการดึงข้อมูล: ตรวจสอบว่าเป็น Object จริงไหม
    let supplier = {};
    if (po.supplier && typeof po.supplier === 'object') {
        supplier = po.supplier;
    }

    // ดึงค่ามาใส่ตัวแปร (Fallback)
    const supName = supplier.name || po.supplierName || '-';
    const supAddress = supplier.address || '-';
    const supContact = supplier.contactPerson || po.supplierContact || '-';
    const supPhone = supplier.phone || '-';
    const supTaxId = supplier.taxId || '-';

    const vendorInfoY = vendorY + 28;

    // คอลัมน์ซ้าย
    setFont(doc, 12);
    doc.text('ชื่อผู้ขาย:', 45, vendorInfoY);
    setFont(doc, 13, true); 
    doc.text(supName, 100, vendorInfoY - 1); 

    setFont(doc, 12);
    doc.text('ที่อยู่:', 45, vendorInfoY + 18);
    setFont(doc, 12); 
    // ใช้ width เพื่อให้ตัดคำถ้ายาวเกิน
    doc.text(supAddress, 100, vendorInfoY + 18, { width: 220 }); 

    // คำนวณความสูงที่ใช้ไปของที่อยู่ เพื่อขยับบรรทัดถัดไป
    const addrHeight = doc.heightOfString(supAddress, { width: 220 });
    const nextLineY = vendorInfoY + 18 + (addrHeight > 15 ? addrHeight : 15);
    
    doc.text('เลขภาษี:', 45, nextLineY + 5);
    doc.text(supTaxId, 100, nextLineY + 5);

    // คอลัมน์ขวา
    const rightColX = 340;
    doc.text('ผู้ติดต่อ:', rightColX, vendorInfoY);
    doc.text(supContact, rightColX + 50, vendorInfoY);

    doc.text('เบอร์โทร:', rightColX, vendorInfoY + 18);
    doc.text(supPhone, rightColX + 50, vendorInfoY + 18);

    doc.text('หมายเหตุ:', rightColX, vendorInfoY + 36);
    doc.text(po.note || '-', rightColX + 50, vendorInfoY + 36, { width: 150 });

    // --- 3. Table Section ---
    let y = vendorInfoY + 80;
    // ถ้าที่อยู่ยาวมาก ให้ดันตารางลงไปอีก
    if (addrHeight > 40) y += 20;

    const col = { no: 40, product: 80, spec: 240, qty: 360, price: 420, total: 490 };
    const colW = { no: 30, product: 150, spec: 110, qty: 50, price: 60, total: 65 };

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

    // Table Items
    setFont(doc, 11);

    if (po.items && po.items.length > 0) {
      po.items.forEach((item, index) => {
        if (y > 700) { doc.addPage(); y = 40; }

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

    doc.moveTo(40, y).lineTo(555, y).strokeColor('#ccc').stroke();

    // --- 4. Summary ---
    y += 10;
    const summaryBoxX = 350;
    const summaryBoxY = y;
    doc.fillColor('#f9f9f9').roundedRect(summaryBoxX, summaryBoxY, 205, 35, 3).fill();
    doc.fillColor('#000');

    setFont(doc, 12, true);
    doc.text('ยอดรวมสุทธิ (Grand Total):', summaryBoxX + 10, summaryBoxY + 10);
    setFont(doc, 16, true);
    doc.text(formatCurrency(po.totalAmount), summaryBoxX + 10, summaryBoxY + 8, { width: 185, align: 'right' });

    // --- 5. Signatures ---
    let signY = y + 70;
    if (signY > 720) { doc.addPage(); signY = 100; }

    const boxW = 200;
    const leftSignX = 60;
    const rightSignX = 340;

    setFont(doc, 11);
    doc.text('_____________________________', leftSignX, signY, { align: 'center', width: boxW });
    doc.text('ผู้จัดทำ (Prepared By)', leftSignX, signY + 15, { align: 'center', width: boxW });
    doc.text(`วันที่: ${formatDate(new Date())}`, leftSignX, signY + 30, { align: 'center', width: boxW });

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
  
      const boxTop = 90;
      doc.fillColor('#f5f5f5').roundedRect(40, boxTop, 515, 60, 5).fill();
      doc.fillColor('#000');
  
      setFont(doc, 12);
      doc.text(`เลขที่เอกสาร: ${receiving.receivingNumber}`, 50, boxTop + 10);
      doc.text(`อ้างอิง PO: ${receiving.po ? receiving.po.poNumber : '-'}`, 50, boxTop + 30);
      doc.text(`ผู้รับของ: ${receiving.receiverName}`, 300, boxTop + 10);
      doc.text(`วันที่รับ: ${formatDate(receiving.receiveDate)}`, 300, boxTop + 30);
  
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

    // 🔴 แก้ไข: ตรวจสอบ object supplier
    let supplier = {};
    if (po.supplier && typeof po.supplier === 'object') {
        supplier = po.supplier;
    }
    const supName = supplier.name || po.supplierName || '-';
    const supContact = supplier.contactPerson || po.supplierContact || '-';

    // Header Info
    ws.addRow([COMPANY_INFO.name]);
    ws.mergeCells('A1:G1');
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.addRow(['ใบสั่งซื้อ / PURCHASE ORDER']).font = { bold: true, size: 12 };
    ws.addRow(['PO Number', po.poNumber]);
    ws.addRow(['Vendor', supName]);      
    ws.addRow(['Contact', supContact]); 
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

exports.exportOrdersToExcel = async (orders, res) => {
  try {
    const wb = new excel.Workbook();
    const ws = wb.addWorksheet('Order Report');

    // 1. กำหนด Header (หัวตาราง)
    ws.columns = [
      { header: '#', key: 'no', width: 5 },
      { header: 'Order No.', key: 'orderNo', width: 18 },
      { header: 'วันที่ (Date)', key: 'date', width: 12 },
      { header: 'เวลา (Time)', key: 'time', width: 10 },
      { header: 'ลูกค้า (Customer)', key: 'customer', width: 20 },
      { header: 'เบอร์โทร', key: 'phone', width: 15 },
      { header: 'รายการสินค้า (Items)', key: 'items', width: 50 }, // กว้างหน่อยสำหรับรายการสินค้า
      { header: 'ยอดรวม (Total)', key: 'total', width: 15 },
      { header: 'สถานะโอนเงิน', key: 'paymentStatus', width: 15 },
      { header: 'สถานะออเดอร์', key: 'orderStatus', width: 15 },
      { header: 'การจัดส่ง', key: 'shipping', width: 15 },
      { header: 'Tracking No.', key: 'tracking', width: 18 },
      { header: 'ที่อยู่จัดส่ง', key: 'address', width: 40 },
    ];

    // 2. ตกแต่งหัวตาราง (Styling)
    const headerRow = ws.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1976D2' } }; // สีน้ำเงิน
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { bottom: { style: 'medium' } };
    });

    // 3. วนลูปใส่ข้อมูล
    orders.forEach((order, index) => {
      // แปลงวันที่และเวลา
      const d = new Date(order.createdAt);
      const dateStr = d.toLocaleDateString('th-TH');
      const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

      // จัดรูปแบบรายการสินค้า (List Items) ให้เป็นบรรทัดๆ ใน 1 ช่อง
      // ตัวอย่าง: 
      // - เสื้อโปโล (L / ขาว) x 1
      // - แก้วเก็บความเย็น x 2
      const itemsList = (order.items || []).map(item => {
        const spec = `${item.size ? item.size : '-'} / ${item.color ? item.color : '-'}`;
        return `- ${item.productName} (${spec}) x ${item.quantity}`;
      }).join('\n'); // ใช้ \n เพื่อขึ้นบรรทัดใหม่

      const row = ws.addRow({
        no: index + 1,
        orderNo: order.orderNo,
        date: dateStr,
        time: timeStr,
        customer: order.customerName,
        phone: order.customerPhone || '-',
        items: itemsList,
        total: order.totalAmount,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        shipping: order.shippingType,
        tracking: order.trackingNumber || '-',
        address: order.customerAddress || '-',
      });

      // 4. จัด Format ของแต่ละ Cell ในแถว
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // ให้ทุกช่องชิดบน (Top) จะได้อ่านง่ายถ้ารายการสินค้ามันยาว
        cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true }; 
        
        // ใส่เส้นขอบบางๆ
        cell.border = {
          top: { style: 'thin', color: { argb: 'E0E0E0' } },
          left: { style: 'thin', color: { argb: 'E0E0E0' } },
          bottom: { style: 'thin', color: { argb: 'E0E0E0' } },
          right: { style: 'thin', color: { argb: 'E0E0E0' } }
        };

        // จัดกลางเฉพาะคอลัมน์สั้นๆ
        if ([1, 2, 3, 4, 9, 10, 11].includes(colNumber)) {
          cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
        }
      });

      // Format ตัวเลขเงิน
      row.getCell('total').numFmt = '#,##0.00';
      row.getCell('total').alignment = { vertical: 'top', horizontal: 'right' };
      row.getCell('total').font = { bold: true };
    });

    // 5. ส่งไฟล์กลับ
    const filename = `Orders_Export_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Export Orders Excel Error:", err);
    res.status(500).send("Error exporting Excel");
  }
};