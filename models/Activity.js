import mongoose, { Schema } from 'mongoose';

const ActivitySchema = new Schema({
  type: { type: String, required: true },
  actor: String,
  ref: String,
  meta: Schema.Types.Mixed
}, { timestamps: true });

export default mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);


