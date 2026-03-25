const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReportSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { 
    type: String, 
    enum: ['mood_board', 'summary_report', 'sales_report', 'client_feedback'], 
    required: true 
  },
  author: {
    id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    role: { type: String, required: true }
  },
  attachments: [{
    filename: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String, required: true }, // image, pdf, doc, etc.
    size: { type: Number },
    thumbnail: String // For images
  }],
  tags: [{ type: String, trim: true }],
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  client: {
    name: String,
    contact: String,
    email: String
  },
  project: {
    name: String,
    description: String,
    status: { type: String, enum: ['ongoing', 'completed', 'on_hold'], default: 'ongoing' }
  },
  visibility: { 
    type: String, 
    enum: ['public', 'team', 'private'], 
    default: 'team' 
  },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'draft' 
  },
  comments: [{
    author: {
      id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true }
    },
    content: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  }],
  likes: [{ 
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    likedAt: { type: Date, default: Date.now }
  }],
  sharedWith: [{
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['viewer', 'editor'], default: 'viewer' },
    sharedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Indexes for better performance
ReportSchema.index({ author: 1, type: 1 });
ReportSchema.index({ visibility: 1, status: 1 });
ReportSchema.index({ createdAt: -1 });
ReportSchema.index({ tags: 1 });

module.exports = mongoose.models.Report || mongoose.model('Report', ReportSchema);
