const mongoose = require('mongoose');
const { Schema } = mongoose;

const CategorySchema = new Schema({
  name: { type: String, required: true, trim: true, unique: true },
  fields: [{
    key: { type: String, required: true },
    type: { type: String, enum: ['text','number','price','dropdown'], default: 'text' },
    options: [String]
  }]
}, { timestamps: true });

module.exports = mongoose.models.Category || mongoose.model('Category', CategorySchema);


