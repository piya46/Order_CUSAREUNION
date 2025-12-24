// src/utils/file.js
const fs = require('fs');

exports.removeFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('Remove file error:', err);
  }
};
