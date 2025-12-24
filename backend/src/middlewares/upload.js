// backend/src/middlewares/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// === ensure dirs ===
const privateDir = path.join(__dirname, '..', 'private_uploads'); // slips (private)
const publicDir  = path.join(__dirname, '..', 'public_uploads');  // product images (public)
if (!fs.existsSync(privateDir)) fs.mkdirSync(privateDir);
if (!fs.existsSync(publicDir))  fs.mkdirSync(publicDir);

// === common ===
const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB
const genName = (orig) => {
  const ext = path.extname(orig).toLowerCase();
  return `${Date.now()}-${Math.round(Math.random()*1e6)}${ext}`;
};

// === filters ===
const imgOnly = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) return cb(null, true);
  cb(new Error('Only image files are allowed!'), false);
};
const imgOrPdf = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') return cb(null, true);
  cb(new Error('Only images or PDF are allowed!'), false);
};

// === storages ===
const slipStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, privateDir),
  filename: (req, file, cb) => cb(null, genName(file.originalname)),
});
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, publicDir),
  filename: (req, file, cb) => cb(null, genName(file.originalname)),
});

// === middlewares export ===
exports.uploadSlip = multer({ storage: slipStorage, limits, fileFilter: imgOrPdf }).single('slip');            // field: 'file'
exports.uploadProductImages = multer({ storage: productStorage, limits, fileFilter: imgOnly }).array('files', 10); // field: 'files'
