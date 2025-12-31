// frontend/adminweb/src/lib/sweetalert.ts
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// กำหนดธีมสีให้ตรงกับ Material UI Theme (Amber/Gold)
const PRIMARY_COLOR = '#FFB300'; 
const DANGER_COLOR = '#d32f2f';
const SUCCESS_COLOR = '#2e7d32';

export const swal = MySwal.mixin({
  customClass: {
    popup: 'swal-custom-popup',
    confirmButton: 'swal-custom-confirm',
    cancelButton: 'swal-custom-cancel'
  },
  buttonsStyling: false, // ปิด Style เดิมของ Browser เพื่อใช้ CSS ของเราเอง
});

export const showLoading = (title = 'กำลังประมวลผล...', text = 'กรุณารอสักครู่') => {
  return swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => {
      swal.showLoading();
    }
  });
};

export const showSuccess = (title = 'ทำรายการสำเร็จ', text = '') => {
  return swal.fire({
    icon: 'success',
    title,
    text,
    confirmButtonText: 'ตกลง',
    timer: 2000,
    timerProgressBar: true
  });
};

export const showError = (title = 'เกิดข้อผิดพลาด', text = '') => {
  return swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'ปิด',
  });
};

export const showConfirm = async (title: string, text: string, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') => {
  const result = await swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons: true,
    focusCancel: true
  });
  return result.isConfirmed;
};