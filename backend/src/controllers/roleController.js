const Role = require('../models/Role');
const auditLogService = require('../services/auditLogService');
const { generateRoleCode } = require('../utils/generate');


exports.getAll = async (_req, res, next) => {
  try {
    const roles = await Role.find().lean();
    res.json(roles);
  } catch (err) { next(err); }
};


exports.getOne = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id).lean();
    if (!role) return res.status(404).json({ error: 'Role not found' });
    res.json(role);
  } catch (err) { next(err); }
};


exports.create = async (req, res, next) => {
  try {
    const { name, permissions, description } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    // ห้ามชื่อซ้ำ
    const exists = await Role.findOne({ name: String(name).trim() });
    if (exists) return res.status(409).json({ error: 'Role name already exists' });

    const role = await Role.create({
      code: generateRoleCode(),                            
      name: String(name).trim(),
      description: typeof description === 'string' ? description : undefined,
      permissions: Array.isArray(permissions) ? permissions : []
    });

    await auditLogService.log({
      user: req.user?.id,
      action: 'ROLE_CREATE',
      detail: { roleId: role._id, name: role.name },
      ip: req.ip
    });

    res.status(201).json(role);
  } catch (err) { next(err); }
};


exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;

    // กันฟิลด์
    const patch = {};
    if (typeof req.body.name === 'string') patch.name = req.body.name.trim();
    if (Array.isArray(req.body.permissions)) patch.permissions = req.body.permissions;
    if (typeof req.body.description === 'string') patch.description = req.body.description;

    // ถ้าจะเปลี่ยนชื่อ ต้องเช็คไม่ซ้ำกับตัวอื่น
    if (patch.name) {
      const dup = await Role.findOne({ name: patch.name, _id: { $ne: id } });
      if (dup) return res.status(409).json({ error: 'Role name already exists' });
    }

    const role = await Role.findByIdAndUpdate(id, patch, { new: true });
    if (!role) return res.status(404).json({ error: 'Role not found' });

    await auditLogService.log({
      user: req.user?.id,
      action: 'ROLE_UPDATE',
      detail: { roleId: role._id, patch: Object.keys(patch) },
      ip: req.ip
    });

    res.json(role);
  } catch (err) { next(err); }
};

/**
 * DELETE /roles/:id
 */
exports.remove = async (req, res, next) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    await auditLogService.log({
      user: req.user?.id,
      action: 'ROLE_DELETE',
      detail: { roleId: req.params.id },
      ip: req.ip
    });

    res.json({ success: true });
  } catch (err) { next(err); }
};

// เผื่อ route เก่าเรียกชื่อ delete
exports.delete = exports.remove;
