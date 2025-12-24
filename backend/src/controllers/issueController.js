const Issue = require('../models/Issue');
const { generateIssueNumber } = require('../utils/generate');
const auditLogService = require('../services/auditLogService');

exports.create = async (req, res, next) => {
  try {
    const issue = new Issue(req.body);
    issue.issueNumber = generateIssueNumber();
    await issue.save();

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_CREATE',
      detail: { issueId: issue._id, issueNumber: issue.issueNumber, refType: issue.refType, refId: issue.refId },
      ip: req.ip
    });

    res.status(201).json(issue);
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const issues = await Issue.find();

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

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_DETAIL_VIEW',
      detail: { issueId: issue._id },
      ip: req.ip
    });

    res.json(issue);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const before = await Issue.findById(req.params.id).lean();
    const issue = await Issue.findByIdAndUpdate(req.params.id, req.body, { new: true });

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_UPDATE',
      detail: { issueId: req.params.id, patch: Object.keys(req.body||{}), before, after: issue },
      ip: req.ip
    });

    res.json(issue);
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    await Issue.findByIdAndDelete(req.params.id);

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_DELETE',
      detail: { issueId: req.params.id },
      ip: req.ip
    });

    res.json({ success: true });
  } catch (err) { next(err); }
};

// ตัวอย่าง upload หลักฐาน (ถ้าเปิดใช้ในอนาคต)
exports.uploadEvidence = async (req, res, next) => {
  try {
    const evidencePaths = req.files.map(f => f.path);
    const issue = await Issue.findByIdAndUpdate(
      req.params.id,
      { $push: { evidenceUrls: { $each: evidencePaths } } },
      { new: true }
    );

    await auditLogService.log({
      user: req.user?.id,
      action: 'ISSUE_UPLOAD_EVIDENCE',
      detail: { issueId: req.params.id, files: evidencePaths },
      ip: req.ip
    });

    res.json(issue);
  } catch (err) { next(err); }
};