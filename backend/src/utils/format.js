// src/utils/format.js

exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
};

exports.formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
};
