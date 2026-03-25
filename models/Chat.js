const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
  sender: {
    id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  content: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['text', 'image', 'file', 'report'], 
    default: 'text' 
  },
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  readBy: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  edited: { type: Boolean, default: false },
  editedAt: { type: Date }
}, { timestamps: true });

const ChatSchema = new Schema({
  name: { type: String, required: true, trim: true },
  type: { 
    type: String, 
    enum: ['group', 'direct'], 
    required: true 
  },
  participants: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  lastMessage: {
    content: String,
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date }
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

// Add messages as a subdocument
ChatSchema.add({ messages: [MessageSchema] });

// Indexes for better performance
ChatSchema.index({ participants: 1, isActive: 1 });
ChatSchema.index({ 'lastMessage.sentAt': -1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);
