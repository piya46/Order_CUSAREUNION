// src/services/mailService.js
const nodemailer = require('nodemailer');
const config = require('../config');

const transporter = nodemailer.createTransport({
  host: config.mailHost,
  port: config.mailPort,
  auth: {
    user: config.mailUser,
    pass: config.mailPass
  }
});

exports.sendMail = async (to, subject, text) => {
  await transporter.sendMail({
    from: config.mailFrom,
    to,
    subject,
    text
  });
};
