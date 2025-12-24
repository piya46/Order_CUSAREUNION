// src/utils/response.js

exports.success = (res, data, message = 'Success') => {
  res.json({ success: true, data, message });
};

exports.error = (res, message = 'Error', status = 400) => {
  res.status(status).json({ success: false, message });
};
