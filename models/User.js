import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','manager','sales'], default: 'sales', index: true },
  code: { type: String, unique: true, index: true },
  avatarUrl: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  try {
    if (!this.isNew || this.code) return next();
    const role = this.role || 'sales';
    const prefix = role === 'admin' ? 'AA' : role === 'manager' ? 'MM' : 'SS';
    const count = await this.constructor.countDocuments({ role });
    const num = String(count + 1).padStart(3, '0');
    this.code = `${prefix}${num}`;
    return next();
  } catch (e) {
    return next(e);
  }
});

export default mongoose.models.User || mongoose.model('User', UserSchema);


