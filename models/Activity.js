const mongoose = require('mongoose');
const { Schema } = mongoose;

const ActivitySchema = new Schema({
  type: { type: String, required: true },
  actor: String,
  ref: String,
  meta: Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);


