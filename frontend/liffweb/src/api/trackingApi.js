
import api from './axios';

/**
 * ดึงข้อมูล Tracking ตามหมายเลขพัสดุ
 * @param {string} trackingNo หมายเลขพัสดุ
 * @returns {Promise} Axios Promise
 */
export const getTracking = (trackingNo) => {
  return api.get(`/tracking/${trackingNo}`);
};