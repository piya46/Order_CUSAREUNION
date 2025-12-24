const mongoose = require('mongoose');
const config = require('./index');

async function connectDb() {
  try {
    const opts = {};
    if (config.dbName) opts.dbName = config.dbName;

    await mongoose.connect(config.mongodbUri, opts);
    console.log('MongoDB connected!');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = connectDb;