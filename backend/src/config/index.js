require('dotenv').config({ quiet: true});
const path = require('path');

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI,
  dbName: process.env.DB_NAME || 'orderDb',

  corsOrigin: process.env.CORS_ORIGIN || '*',

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  uploadPath: process.env.UPLOAD_PATH || path.join(__dirname, '..', 'uploads'),

  lineNotifyToken: process.env.LINE_NOTIFY_TOKEN || '',
  lineChannelId: process.env.LINE_CHANNEL_ID || '',
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET || '',
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  adminLineUserIds: process.env.LINE_ADMIN_USER_IDS
    ? process.env.LINE_ADMIN_USER_IDS.split(',').map(id => id.trim())
    : [],

  slipOkApiUrl: process.env.SLIPOK_API_URL || '',
  slipOkApiKey: process.env.SLIPOK_API_KEY || '',

  thaiPostApiKey: process.env.THAIPOST_API_KEY || '',
  thaiPostApiUrl: process.env.THAIPOST_API_URL || '',

  mailHost: process.env.MAIL_HOST || '',
  mailPort: process.env.MAIL_PORT || '',
  mailUser: process.env.MAIL_USER || '',
  mailPass: process.env.MAIL_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',

  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  s3BucketName: process.env.S3_BUCKET_NAME || '',
  s3Region: process.env.S3_REGION || '',

  timezone: process.env.TZ || 'Asia/Bangkok',
  baseUrl: process.env.BASE_URL || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  publicUploadPath: process.env.PUBLIC_UPLOAD_PATH
};

module.exports = config;
