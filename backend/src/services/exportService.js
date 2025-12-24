const PDFDocument = require('pdfkit');
const excel = require('exceljs');

exports.exportPOtoPDF = (po, res) => {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="PO_${po.poNumber}.pdf"`);
  doc.pipe(res); // << pipe ก่อน
  doc.text(`PO Number: ${po.poNumber}\nSupplier: ${po.supplierName}\n...`);
  doc.end();     // << end หลังสุด
};

exports.exportPOtoExcel = async (po, res) => {
  const wb = new excel.Workbook();
  const ws = wb.addWorksheet('PO');
  ws.addRow(['PO Number', po.poNumber]);
  ws.addRow(['Supplier', po.supplierName]);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PO_${po.poNumber}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

exports.exportReceivingToPDF = (receiving, res) => {
  const doc = new PDFDocument();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Receiving_${receiving._id}.pdf"`);
  doc.pipe(res); // << pipe ก่อน
  doc.text(`Receiving ID: ${receiving._id}\nReceiver: ${receiving.receiverName}\n...`);
  doc.end();     // << end หลังสุด
};

exports.exportReceivingToExcel = async (receiving, res) => {
  const wb = new excel.Workbook();
  const ws = wb.addWorksheet('Receiving');
  ws.addRow(['Receiving ID', receiving._id]);
  ws.addRow(['Receiver', receiving.receiverName]);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Receiving_${receiving._id}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};