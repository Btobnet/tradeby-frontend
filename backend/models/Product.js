// backend/models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    brand:    String,
    price:    { type: Number, required: true },
    store:    { type: String, required: true },
    category: String,
    image:    String
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
