const mongoose = require('mongoose');
const { Schema } = mongoose;

const TaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  assignee: { 
    id: { type: String, required: true, index: true },
    name: String,
    code: String,
    email: String
  },
  createdBy: { 
    id: { type: String, required: true },
    name: String,
    code: String,
    email: String
  },
  dueAt: Date,
  status: { 
    type: String, 
    enum: ['pending','in_progress','completed','overdue','cancelled'], 
    default: 'pending', 
    index: true 
  },
  priority: { 
    type: String, 
    enum: ['low','medium','high','urgent'], 
    default: 'medium' 
  },
  category: { type: String, default: 'general' },
  location: {
    name: String,
    coords: { lat: Number, lng: Number }
  },
  attachments: [{
    type: { type: String, enum: ['image','video','audio','document'] },
    url: String,
    name: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  comments: [{
    text: String,
    author: { id: String, name: String, code: String },
    createdAt: { type: Date, default: Date.now }
  }],
  notifications: [{
    type: { type: String, enum: ['assigned','updated','overdue','completed'] },
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Pre-save hook to handle overdue tasks and notifications
TaskSchema.pre('save', function(next) {
  // Mark as overdue if past due date and not completed
  if (this.dueAt && this.dueAt < new Date() && !['completed', 'cancelled'].includes(this.status)) {
    this.status = 'overdue';
  }
  
  // Create notification for new tasks
  if (this.isNew) {
    this.notifications.push({
      type: 'assigned',
      message: `New task assigned: ${this.title}`,
      read: false
    });
  }
  
  next();
});

module.exports = mongoose.models.Task || mongoose.model('Task', TaskSchema);


