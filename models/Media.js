const mongoose = require('mongoose');
const { Schema } = mongoose;

const MediaSchema = new Schema({
  kind: { type: String, enum: ['image','video','audio'], required: true },
  url: { type: String, required: true },
  thumbUrl: String,
  uploadedBy: String,
  location: { lat: Number, lng: Number },
  tags: [String],
  transcript: String,
  transcriptLang: String
}, { timestamps: true });

module.exports = mongoose.models.Media || mongoose.model('Media', MediaSchema);


