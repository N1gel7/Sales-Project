const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },
  details: String,
  attributes: Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);


