const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

exports.verifySlipByFile = async (filePath, amount) => {
  const form = new FormData();
  form.append('files', fs.createReadStream(filePath));   // ชื่อ field ต้องเป็น 'file' เท่านั้น
  form.append('amount', String(amount));
  form.append('log', 'true');

  try {
    const res = await axios.post(
      `https://api.slipok.com/api/line/apikey/${process.env.slipOkBranchId}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'x-authorization': process.env.SLIPOK_API_KEY,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    return res.data;
  } catch (err) {
    if (err.response && err.response.data) return err.response.data;
    throw err;
  }
};