const mongoose = require('mongoose');
const { Schema } = mongoose;

const UploadSchema = new Schema({
  type: { type: String, enum: ['image','video','audio','note'], default: 'image' },
  note: String,
  taskId: String,
  mediaUrl: String,
  transcript: String,
  coords: { lat: Number, lng: Number },
  user: { id: String, email: String, code: String },
}, { timestamps: true });

module.exports = mongoose.models.Upload || mongoose.model('Upload', UploadSchema);
