const config = require('./index');

function validateConfig() {
  const required = [
    'port', 'mongodbUri', 'jwtSecret'
  ];
  required.forEach((key) => {
    if (!config[key] || config[key] === '') {
      throw new Error(`Missing required config: ${key}`);
    }
  });
}

module.exports = validateConfig;
