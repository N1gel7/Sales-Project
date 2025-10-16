import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','manager','sales'], default: 'sales', index: true },
  avatarUrl: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);


