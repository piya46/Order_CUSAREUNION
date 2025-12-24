const Supplier = require('../models/Supplier');
// ถ้ามีระบบ Audit Log ให้ import มาใช้ด้วย (ถ้าไม่มีลบออกได้ครับ)
const auditLogService = require('../services/auditLogService'); 

// 1. Get All Suppliers (Active Only) - สำหรับ Dropdown หรือตาราง
exports.list = async (req, res, next) => {
  try {
    // ดึงเฉพาะที่ยังเปิดใช้งาน (isActive: true)
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    res.json(suppliers);
  } catch (err) { next(err); }
};

// 2. Get One Supplier - สำหรับดูรายละเอียด
exports.getOne = async (req, res, next) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json(supplier);
  } catch (err) { next(err); }
};

// 3. Create Supplier
exports.create = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    
    // Log Activity
    if (auditLogService) {
        await auditLogService.log({
            user: req.user?.id,
            action: 'SUPPLIER_CREATE',
            detail: { name: supplier.name, id: supplier._id },
            ip: req.ip
        });
    }

    res.status(201).json(supplier);
  } catch (err) { next(err); }
};

// 4. Update Supplier
exports.update = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true } // new: true เพื่อส่งค่าใหม่กลับไป
    );

    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Log Activity
    if (auditLogService) {
        await auditLogService.log({
            user: req.user?.id,
            action: 'SUPPLIER_UPDATE',
            detail: { id: supplier._id, changes: req.body },
            ip: req.ip
        });
    }

    res.json(supplier);
  } catch (err) { next(err); }
};

// 5. Delete Supplier (Soft Delete)
// แนะนำให้ใช้ Soft Delete เพื่อไม่ให้ PO เก่าๆ พัง
exports.delete = async (req, res, next) => {
  try {
    // ปรับ isActive เป็น false แทนการลบจริง
    const supplier = await Supplier.findByIdAndUpdate(
        req.params.id, 
        { isActive: false },
        { new: true }
    );

    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    // Log Activity
    if (auditLogService) {
        await auditLogService.log({
            user: req.user?.id,
            action: 'SUPPLIER_DELETE',
            detail: { id: supplier._id, name: supplier.name },
            ip: req.ip
        });
    }

    res.json({ success: true, message: 'Supplier deactivated successfully' });
  } catch (err) { next(err); }
};