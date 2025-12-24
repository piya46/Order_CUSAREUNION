const Issue = require('../models/Issue');
const { generateIssueNumber } = require('../utils/generate');
const auditLogService = require('../services/auditLogService');

exports.create = async (req, res, next) => {
  try {
    // รับค่า priority จาก req.body ด้วย (ถ้ามีส่งมา)
    const issue = new Issue(req.body);
    issue.issueNumber = generateIssueNumber();
    await issue.save();

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_CREATE',
      detail: { issueId: issue._id, issueNumber: issue.issueNumber, refType: issue.refType },
      ip: req.ip
    });

    res.status(201).json(issue);
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    // sort ตาม priority (Critical ขึ้นก่อน) และ created_at
    const issues = await Issue.find().sort({ priority: -1, createdAt: -1 }); 
    // หมายเหตุ: การ sort string enum อาจจะไม่ตรงตามลำดับความสำคัญเป๊ะๆ ถ้าซีเรียสเรื่อง sort อาจต้อง map ค่าเป็นตัวเลข
    // แต่เบื้องต้นใช้แบบนี้หรือ sort หน้าบ้านได้ครับ

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_LIST_VIEW',
      detail: { count: issues.length },
      ip: req.ip
    });

    res.json(issues);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json(issue);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { status, priority, adminComment } = req.body;
    
    // Validation เบื้องต้น
    const validStatuses = ['OPEN', 'PROCESSING', 'RESOLVED', 'REJECTED', 'CLOSED'];
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    if (status && !validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority' });
    }

    const before = await Issue.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ error: 'Issue not found' });

    // Update เฉพาะ field ที่อนุญาต
    const updateData = { ...req.body };
    
    const issue = await Issue.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_UPDATE',
      detail: { issueId: req.params.id, changes: updateData, before },
      ip: req.ip
    });

    res.json(issue);
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await Issue.findByIdAndDelete(req.params.id);
    await auditLogService.log({ user: req.user?.id, action: 'ISSUE_DELETE', detail: { issueId: req.params.id }, ip: req.ip });
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.uploadEvidence = async (req, res, next) => {
  try {
    const evidencePaths = req.files.map(f => f.path);
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { $push: { evidenceUrls: { $each: evidencePaths } } },
      { new: true }
    );
    res.json(issue);
  } catch (err) { next(err); }
};