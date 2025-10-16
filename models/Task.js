import mongoose, { Schema } from 'mongoose';

const TaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  assignee: { type: String, required: true, index: true },
  dueAt: Date,
  status: { type: String, enum: ['pending','in_progress','done'], default: 'pending', index: true },
  createdBy: String
}, { timestamps: true });

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);


