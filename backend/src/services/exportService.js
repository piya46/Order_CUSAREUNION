const PDFDocument = require('pdfkit');
const excel = require('exceljs');
const path = require('path');
const fs = require('fs');

// --- Helper: ตั้งค่าฟอนต์ ---
const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
// เช็คว่ามีไฟล์ฟอนต์จริงไหม เพื่อป้องกัน Error
const hasThaiFont = fs.existsSync(fontPath);

const setFont = (doc, size = 14) => {
  if (hasThaiFont) {
    doc.font(fontPath).fontSize(size);
  } else {
    // Fallback ถ้าไม่มีฟอนต์ไทย ให้ใช้ Helvetica
    doc.font('Helvetica').fontSize(size);
  }
};

// --- Helper: วาดเส้นคั่น ---
const generateHr = (doc, y) => {
  doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
};

// --- Helper: จัดรูปแบบวันที่ ---
const formatDate = (date) => {
  if(!date) return '-';
  try {
    return new Date(date).toLocaleDateString('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch (e) { return '-'; }
};

// --- Helper: จัดรูปแบบเงิน ---
const formatCurrency = (amount) => {
  return Number(amount || 0).toLocaleString('th-TH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
};

// ==========================================
// 1. Export Purchase Order (PO) -> PDF
// ==========================================
exports.exportPOtoPDF = (po, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Handle Error ภายใน Stream
    doc.on('error', (err) => {
        console.error("PDF Stream Error:", err);
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="PO_${po.poNumber}.pdf"`);
    
    doc.pipe(res);

    // 1. Header (หัวกระดาษ)
    // ✅ แก้ไข: เช็คไฟล์รูปก่อนโหลด เพื่อป้องกัน Crash
    const logoPath = path.join(__dirname, '../public/uploads/logo_placeholder.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 50 });
    }

    setFont(doc, 20);
    // ขยับข้อความตามความเหมาะสม (ถ้ามีโลโก้ หรือไม่มี)
    const textX = fs.existsSync(logoPath) ? 110 : 50; 

    doc.text('COMPANY NAME / ชื่อบริษัท', textX, 57) 
       .fontSize(10).text('123 ถนนตัวอย่าง แขวงตัวอย่าง เขตตัวอย่าง กทม. 10XXX', textX, 80)
       .text('Tel: 02-XXX-XXXX | Email: contact@example.com', textX, 95);
       
    setFont(doc, 25);
    doc.text('PURCHASE ORDER', 0, 50, { align: 'right' }); 
    doc.fontSize(10).text('ใบสั่งซื้อสินค้า', 0, 75, { align: 'right' });

    generateHr(doc, 115);

    // 2. Customer & PO Info
    const customerTop = 130;
    setFont(doc, 14);
    doc.text('Vendor (ผู้ขาย):', 50, customerTop)
       .fontSize(16).text(po.supplierName || '-', 50, customerTop + 20)
       .fontSize(12).text(po.supplierContact || 'Contact: -', 50, customerTop + 40);

    setFont(doc, 12);
    const rightColX = 350;
    doc.text('PO Number:', rightColX, customerTop)
       .text(po.poNumber, rightColX + 80, customerTop, { align: 'right' })
       .text('Date:', rightColX, customerTop + 15)
       .text(formatDate(po.orderDate), rightColX + 80, customerTop + 15, { align: 'right' })
       .text('Status:', rightColX, customerTop + 30)
       .text(po.status, rightColX + 80, customerTop + 30, { align: 'right' });

    // 3. Table Header
    const tableTop = 220;
    setFont(doc, 12);
    
    const itemCodeX = 50;
    const descX = 100;
    const specX = 280;
    const priceX = 370;
    const qtyX = 440;
    const totalX = 500;

    doc.fillColor('#f0f0f0').rect(50, tableTop, 500, 20).fill();
    doc.fillColor('#000000');

    doc.text('#', itemCodeX, tableTop + 5, { width: 40 })
       .text('Product Name', descX, tableTop + 5)
       .text('Spec', specX, tableTop + 5)
       .text('Price', priceX, tableTop + 5, { width: 60, align: 'right' })
       .text('Qty', qtyX, tableTop + 5, { width: 40, align: 'right' })
       .text('Total', totalX, tableTop + 5, { width: 50, align: 'right' });

    // 4. Items
    let y = tableTop + 25;
    setFont(doc, 12);

    if (po.items && po.items.length > 0) {
        po.items.forEach((item, index) => {
            if (y > 700) {
              doc.addPage();
              y = 50;
            }

            const productName = item.product?.name || item.productName || 'Unknown';
            const spec = `${item.size || '-'} ${item.color || ''}`.trim();
            const lineTotal = (item.quantity || 0) * (item.price || 0);

            doc.text(index + 1, itemCodeX, y, { width: 40 })
               .text(productName, descX, y, { width: 170 })
               .text(spec, specX, y, { width: 80 })
               .text(formatCurrency(item.price), priceX, y, { width: 60, align: 'right' })
               .text(item.quantity, qtyX, y, { width: 40, align: 'right' })
               .text(formatCurrency(lineTotal), totalX, y, { width: 50, align: 'right' });
            
            y += 20;
        });
    }

    generateHr(doc, y);

    // 5. Summary
    const summaryTop = y + 15;
    setFont(doc, 14);
    doc.text('Grand Total:', 300, summaryTop, { width: 140, align: 'right' })
       .fontSize(16)
       .text(`${formatCurrency(po.totalAmount)} THB`, 450, summaryTop - 2, { width: 100, align: 'right' });

    // 6. Signature
    const signTop = 700;
    if (y > 600) doc.addPage(); 

    setFont(doc, 12);
    doc.text('_______________________', 50, signTop)
       .text('Prepared By', 50, signTop + 15)
       .text(`Date: ${formatDate(new Date())}`, 50, signTop + 30);

    doc.text('_______________________', 400, signTop)
       .text('Approved By', 400, signTop + 15)
       .text('Date: ____/____/____', 400, signTop + 30);

    doc.end();

  } catch (err) {
    console.error("PDF Export Error:", err);
    if (!res.headersSent) {
        res.status(500).send("Error generating PDF");
    } else {
        res.end();
    }
  }
};

// ==========================================
// 2. Export Receiving (ใบรับของ) -> PDF
// ==========================================
exports.exportReceivingToPDF = (receiving, res) => {
  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('error', (err) => console.error("PDF Stream Error:", err));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="RC_${receiving.receivingNumber}.pdf"`);
    doc.pipe(res);

    // Header
    // ✅ แก้ไข: เช็คไฟล์รูปก่อนโหลด
    const logoPath = path.join(__dirname, '../public/uploads/logo_placeholder.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 40 });
    }

    setFont(doc, 25);
    doc.text('RECEIVING NOTE', 0, 50, { align: 'center' });
    doc.fontSize(12).text('ใบรับสินค้าเข้าคลัง', 0, 80, { align: 'center' });

    generateHr(doc, 100);

    // Info
    const infoTop = 120;
    setFont(doc, 14);
    doc.text(`Receiving No: ${receiving.receivingNumber}`, 50, infoTop)
       .text(`Reference PO: ${receiving.po ? receiving.po.poNumber : '-'}`, 50, infoTop + 20)
       .text(`Receiver: ${receiving.receiverName}`, 300, infoTop)
       .text(`Date: ${formatDate(receiving.receiveDate)}`, 300, infoTop + 20);

    // Table
    const tableTop = 180;
    doc.fillColor('#f0f0f0').rect(50, tableTop, 500, 20).fill();
    doc.fillColor('#000000');

    setFont(doc, 12);
    doc.text('#', 50, tableTop + 5, { width: 30 })
       .text('Product Name', 90, tableTop + 5, { width: 200 })
       .text('Variant', 300, tableTop + 5, { width: 100 })
       .text('Quantity', 450, tableTop + 5, { width: 100, align: 'right' });

    let y = tableTop + 30;
    
    if (receiving.items) {
        receiving.items.forEach((item, idx) => {
            if (y > 700) { doc.addPage(); y = 50; }

            const productName = item.product?.name || 'Unknown Product';
            const variant = `${item.size || ''} ${item.color || ''}`.trim() || '-';

            doc.text(idx + 1, 50, y, { width: 30 })
               .text(productName, 90, y, { width: 200 })
               .text(variant, 300, y, { width: 100 })
               .text(item.quantity, 450, y, { width: 100, align: 'right' });
            
            y += 20;
        });
    }

    generateHr(doc, y + 10);

    // Signature
    const signTop = y + 50 > 700 ? 700 : y + 50; 
    if (signTop === 700 && y > 650) doc.addPage();

    setFont(doc, 12);
    doc.text('Received By', 400, signTop)
       .text('_______________________', 400, signTop + 20)
       .text(`( ${receiving.receiverName} )`, 400, signTop + 40, { align: 'center', width: 120 });

    doc.end();

  } catch (err) {
    console.error("Receiving PDF Error:", err);
    if (!res.headersSent) res.status(500).send("Error generating PDF");
    else res.end();
  }
};

// ==========================================
// 3. Export PO -> Excel
// ==========================================
exports.exportPOtoExcel = async (po, res) => {
  try {
    const wb = new excel.Workbook();
    const ws = wb.addWorksheet('Purchase Order');

    const headerStyle = { font: { bold: true, size: 12 } };
    const borderStyle = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };

    ws.addRow(['PURCHASE ORDER']).font = { bold: true, size: 16 };
    ws.addRow(['PO Number', po.poNumber]);
    ws.addRow(['Supplier', po.supplierName]);
    ws.addRow(['Date', formatDate(po.orderDate)]);
    ws.addRow(['Status', po.status]);
    ws.addRow([]); 

    const headerRow = ws.addRow(['#', 'Product Name', 'Size', 'Color', 'Quantity', 'Unit Price', 'Total']);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
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
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2E7D32' } };
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