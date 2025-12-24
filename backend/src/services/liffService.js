// src/services/liffService.js
const axios = require('axios');
const config = require('../config');

exports.pushMessage = async (userId, message) => {
  await axios.post('https://api.line.me/v2/bot/message/push', {
    to: userId,
    messages: [{ type: 'text', text: message }]
  }, {
    headers: {
      'Authorization': `Bearer ${config.lineChannelAccessToken}`
    }
  });
};
