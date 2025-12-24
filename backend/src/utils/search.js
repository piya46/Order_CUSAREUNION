// src/utils/search.js

exports.filterPO = (poList, query) => {
  // query: { supplierName, status, startDate, endDate }
  return poList.filter(po => {
    let ok = true;
    if (query.supplierName && !po.supplierName.includes(query.supplierName)) ok = false;
    if (query.status && po.status !== query.status) ok = false;
    if (query.startDate && new Date(po.orderDate) < new Date(query.startDate)) ok = false;
    if (query.endDate && new Date(po.orderDate) > new Date(query.endDate)) ok = false;
    return ok;
  });
};
