const mongoose = require('mongoose');

const sizeVariantSchema = new mongoose.Schema({
  size: { type: String, required: true },       
  color: String,                                
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  locked: { type: Number, default: 0 }
});

const productSchema = new mongoose.Schema({
  productCode: { type: String, unique: true },  
  name: { type: String, required: true },
  description: String,
  category: String,
  preorder: { type: Boolean, default: false },
  images: [String],
  availableFrom: Date,
  availableTo: Date,
  isActive: { type: Boolean, default: true },
  variants: [sizeVariantSchema],               
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
