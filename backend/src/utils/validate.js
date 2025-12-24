exports.isPositiveInteger = (val) => {
  return Number.isInteger(val) && val > 0;
};

exports.isPhoneNumber = phone =>
  typeof phone === 'string' && /^0[689]\d{8}$/.test(phone);

exports.isEmail = email =>
  typeof email === 'string' && /^[\w\-.]+@[\w\-]+\.\w{2,}$/.test(email);

exports.isLineId = lineId =>
  typeof lineId === 'string' && /^U[a-fA-F0-9]{32}$/.test(lineId);