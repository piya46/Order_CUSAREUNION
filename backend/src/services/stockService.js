const Product = require('../models/Product');

// ล็อก/ปลดล็อกตามโครงสร้าง variants.$.{stock, locked}
exports.lock = async (orderItems) => {
  for (const it of orderItems) {
    await Product.updateOne(
      { _id: it.product, 'variants.size': it.size, 'variants.color': it.color },
      { $inc: { 'variants.$.stock': -it.quantity, 'variants.$.locked': it.quantity } }
    );
  }
};

exports.unlock = async (orderItems) => {
  for (const it of orderItems) {
    await Product.updateOne(
      { _id: it.product, 'variants.size': it.size, 'variants.color': it.color },
      { $inc: { 'variants.$.stock': it.quantity, 'variants.$.locked': -it.quantity } }
    );
  }
};