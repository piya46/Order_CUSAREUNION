const path = require('path');
const fs = require('fs');
const Product = require('../models/Product');
const SaleHistory = require('../models/SaleHistory'); // ✅ ใช้รวมยอดที่ชำระแล้ว
const { generateProductCode } = require('../utils/generate');
const auditLogService = require('../services/auditLogService'); // ✅ เพิ่ม

const PUBLIC_DIR = path.join(__dirname, '..', 'public_uploads');

const toPublicUrl = (req, filename) =>
  `${req.protocol}://${req.get('host')}/public_uploads/${encodeURIComponent(filename)}`;

function toDTO(req, p) {
  const obj = p.toObject ? p.toObject() : p;
  return {
    ...obj,
    imageUrls: (obj.images || []).map(f => toPublicUrl(req, f)),
  };
}

function isAfter(d) { return d ? Date.now() > new Date(d).getTime() : false; }
async function autoCloseIfExpired(p) {
  if (p.availableTo && isAfter(p.availableTo) && p.isActive !== false) {
    p.isActive = false;
    await p.save();
  }
}

exports.create = async (req, res, next) => {
  try {
    const product = new Product(req.body);
    product.productCode = generateProductCode();
    await autoCloseIfExpired(product);
    await product.save();

    // ✅ Audit
    await auditLogService.log({
      user: req.user?.id,
      action: 'PRODUCT_CREATE',
      detail: { productId: product._id, name: product.name },
      ip: req.ip
    });

    res.status(201).json(toDTO(req, product));
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const products = await Product.find();
    await Promise.all(products.map(p => autoCloseIfExpired(p)));
    res.json(products.map(p => toDTO(req, p)));
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await autoCloseIfExpired(product);
    res.json(toDTO(req, product));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const before = await Product.findById(req.params.id).lean();
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await autoCloseIfExpired(product);

    // ✅ Audit (diff เฉพาะฟิลด์ที่ส่งมา)
    await auditLogService.log({
      user: req.user?.id,
      action: 'PRODUCT_UPDATE',
      detail: { productId: product._id, patch: Object.keys(req.body || {}), before, after: product },
      ip: req.ip
    });

    res.json(toDTO(req, product));
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const before = await Product.findById(req.params.id).lean();
    await Product.findByIdAndDelete(req.params.id);

    // ✅ Audit
    await auditLogService.log({
      user: req.user?.id,
      action: 'PRODUCT_DELETE',
      detail: { productId: req.params.id, before },
      ip: req.ip
    });

    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.uploadImages = async (req, res, next) => {
  try {
    const filenames = (req.files || []).map(f => f.filename);
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $push: { images: { $each: filenames } } },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // ✅ Audit
    await auditLogService.log({
      user: req.user?.id,
      action: 'PRODUCT_UPLOAD_IMAGES',
      detail: { productId: product._id, files: filenames },
      ip: req.ip
    });

    res.json(toDTO(req, product));
  } catch (err) { next(err); }
};

exports.deleteImage = async (req, res, next) => {
  try {
    const { id, filename } = req.params;
    if (!/^[\w\-.]+$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const product = await Product.findByIdAndUpdate(
      id,
      { $pull: { images: filename } },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const filePath = path.join(PUBLIC_DIR, filename);
    if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch {} }

    // ✅ Audit
    await auditLogService.log({
      user: req.user?.id,
      action: 'PRODUCT_DELETE_IMAGE',
      detail: { productId: id, filename },
      ip: req.ip
    });

    res.json(toDTO(req, product));
  } catch (err) { next(err); }
};

// ✅ NEW: /products/inventory — รวม paidQty ต่อ variant จาก SaleHistory
exports.getInventory = async (req, res, next) => {
  try {
    // 1) ดึง products มาเป็น plain objects
    const products = await Product.find().lean();

    // 2) รวมยอดขายที่ "ชำระสำเร็จ" จาก SaleHistory
    const paid = await SaleHistory.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: {
            product: "$items.product",
            size: { $ifNull: ["$items.size", ""] },
            color: { $ifNull: ["$items.color", ""] }
          },
          qty: { $sum: { $ifNull: ["$items.quantity", 0] } }
        }
      }
    ]);

    // 3) ทำเป็น map เพื่อจับคู่กับแต่ละ variant
    const paidMap = new Map();
    for (const row of paid) {
      const key = `${row._id.product}:${String(row._id.size || "").toLowerCase()}:${String(row._id.color || "").toLowerCase()}`;
      paidMap.set(key, row.qty);
    }

    // 4) ผูก paidQty เข้าในแต่ละ variant + เติม imageUrls
    const result = products.map(p => {
      const variants = (p.variants || []).map(v => {
        const key = `${p._id.toString()}:${String(v.size || "").toLowerCase()}:${String(v.color || "").toLowerCase()}`;
        const paidQty = paidMap.get(key) || 0;
        return { ...v, paidQty }; // frontend จะอ่าน v.paidQty ไปแสดงเป็น "จองไว้" เมื่อเป็น preorder
      });
      return {
        ...p,
        variants,
        imageUrls: (p.images || []).map(f => toPublicUrl(req, f))
      };
    });

    // ✅ Audit (read event สำหรับผู้มีสิทธิ์)
    await auditLogService.log({
      user: req.user?.id,
      action: 'PRODUCT_INVENTORY_VIEW',
      detail: { count: result.length },
      ip: req.ip
    });

    res.json(result);
  } catch (err) { next(err); }
};

// เส้นทางเก่า (ไม่ใช้แล้ว)
exports.getImage = async (_req, res) =>
  res.status(410).json({ error: 'Gone. Use /public_uploads instead.' });