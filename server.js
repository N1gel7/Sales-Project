const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Product = require('./models/Product');
const Task = require('./models/Task');
const Invoice = require('./models/Invoice');
const User = require('./models/User');
const Category = require('./models/Category');
const Upload = require('./models/Upload');
const Chat = require('./models/Chat');
const Report = require('./models/Report');
const sgMail = require('@sendgrid/mail');

const app = express();

// Configure EJS as view engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Serve static files from public directory
app.use(express.static('public'));

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Increase JSON payload limit for large files
app.use(express.urlencoded({ limit: '100mb', extended: true })); // Add URL-encoded support

// Set Content Security Policy to allow external scripts
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://cdnjs.cloudflare.com; " +
    "connect-src 'self' https://api.openstreetmap.org;"
  );
  next();
});

// Add timeout configuration for large uploads
app.use((req, res, next) => {
  res.setTimeout(300000); // 5 minutes timeout for large file uploads
  next();
});

const PORT = process.env.API_PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

// Start the server regardless of MongoDB connection
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
  console.log('Server started successfully!');
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI, { dbName: 'sample_mfix' }).then(() => {
  console.log('Connected to MongoDB successfully');
}).catch((e) => {
  console.error('MongoDB connection error:', e.message);
  console.log('Server will continue running without MongoDB connection');
});

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// EJS Routes for serving HTML pages
app.get('/', async (req, res) => {
  try {
    // Get dashboard data
    const totalProducts = await Product.countDocuments();
    const activeTasks = await Task.countDocuments({ status: { $in: ['pending', 'in_progress'] } });
    const pendingInvoices = await Invoice.countDocuments({ status: 'pending' });
    const totalRevenue = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    
    const recentTasks = await Task.find().sort({ createdAt: -1 }).limit(5).populate('assignedTo', 'name');
    const recentInvoices = await Invoice.find().sort({ createdAt: -1 }).limit(5);
    
    res.render('index', {
      title: 'Dashboard',
      totalProducts,
      activeTasks,
      pendingInvoices,
      totalRevenue: totalRevenue[0]?.total || 0,
      recentTasks,
      recentInvoices
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('index', {
      title: 'Dashboard',
      totalProducts: 0,
      activeTasks: 0,
      pendingInvoices: 0,
      totalRevenue: 0,
      recentTasks: [],
      recentInvoices: []
    });
  }
});

// Login page route
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login' });
});

// Map page route
app.get('/map', (req, res) => {
  res.render('map', { title: 'Map View' });
});

// Map test page route
app.get('/map-test', (req, res) => {
  res.render('map-test', { title: 'Map Test' });
});

app.get('/products', async (req, res) => {
  try {
    const products = await Product.find().populate('category');
    const categories = await Category.find();
    res.render('products', {
      title: 'Products',
      products,
      categories
    });
  } catch (error) {
    console.error('Products page error:', error);
    res.render('products', {
      title: 'Products',
      products: [],
      categories: []
    });
  }
});

// ==================== CHAT API ENDPOINTS ====================

// Get all chats for a user
app.get('/api/chats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const chats = await Chat.find({
      'participants.user': userId,
      isActive: true
    })
    .populate('participants.user', 'name email role')
    .populate('lastMessage.sender', 'name')
    .populate('createdBy', 'name')
    .sort({ 'lastMessage.sentAt': -1, updatedAt: -1 });

    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new chat
app.post('/api/chats', requireAuth, async (req, res) => {
  try {
    const { name, type, participants } = req.body;
    const userId = req.user.uid;

    // Validate participants
    const participantIds = participants.map(p => p.user || p);
    const users = await User.find({ _id: { $in: participantIds } });
    
    if (users.length !== participantIds.length) {
      return res.status(400).json({ error: 'One or more participants not found' });
    }

    // Add creator to participants
    const chatParticipants = [
      { user: userId, role: 'admin' },
      ...participants.map(p => ({
        user: p.user || p,
        role: 'member'
      }))
    ];

    const chat = new Chat({
      name,
      type,
      participants: chatParticipants,
      createdBy: userId
    });

    await chat.save();
    await chat.populate('participants.user', 'name email role');
    await chat.populate('createdBy', 'name');

    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific chat
app.get('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.uid;

    // Check if user is participant
    const chat = await Chat.findOne({
      _id: id,
      'participants.user': userId,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    const skip = (page - 1) * limit;
    const messages = await Chat.findById(id)
      .select('messages')
      .populate('messages.sender.id', 'name role')
      .slice('messages', [skip, parseInt(limit)])
      .sort({ 'messages.createdAt': -1 });

    res.json(messages.messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send a message
app.post('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type = 'text', attachments = [] } = req.body;
    const userId = req.user.uid;

    // Check if user is participant
    const chat = await Chat.findOne({
      _id: id,
      'participants.user': userId,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    // Get user info
    const user = await User.findById(userId);

    const message = {
      sender: {
        id: userId,
        name: user.name,
        role: user.role
      },
      content,
      type,
      attachments,
      readBy: [{ user: userId }]
    };

    // Add message to chat
    chat.messages.push(message);
    
    // Update last message
    chat.lastMessage = {
      content,
      sender: userId,
      sentAt: new Date()
    };

    await chat.save();

    // Populate the new message
    await chat.populate('messages.sender.id', 'name role');

    const newMessage = chat.messages[chat.messages.length - 1];
    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as read
app.put('/api/chats/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const chat = await Chat.findOne({
      _id: id,
      'participants.user': userId,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found or access denied' });
    }

    // Mark all unread messages as read
    chat.messages.forEach(message => {
      const alreadyRead = message.readBy.some(read => read.user.toString() === userId);
      if (!alreadyRead) {
        message.readBy.push({ user: userId });
      }
    });

    await chat.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== REPORTS API ENDPOINTS ====================

// Get all reports
app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const { type, status = 'published', page = 1, limit = 20 } = req.query;
    const userId = req.user.uid;

    let query = {
      $or: [
        { visibility: 'public' },
        { visibility: 'team' },
        { 'sharedWith.user': userId },
        { 'author.id': userId }
      ]
    };

    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const reports = await Report.find(query)
      .populate('author.id', 'name role')
      .populate('comments.author.id', 'name')
      .populate('likes.user', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new report
app.post('/api/reports', requireAuth, async (req, res) => {
  try {
    const { title, description, type, tags = [], location, client, project, visibility = 'team' } = req.body;
    const userId = req.user.uid;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const report = new Report({
      title,
      description,
      type,
      author: {
        id: userId,
        name: user.name,
        role: user.role
      },
      tags,
      location,
      client,
      project,
      visibility
    });

    await report.save();
    await report.populate('author.id', 'name role');

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload attachments to a report
app.post('/api/reports/:id/attachments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { attachments } = req.body;
    const userId = req.user.uid;

    const report = await Report.findOne({
      _id: id,
      $or: [
        { 'author.id': userId },
        { 'sharedWith.user': userId, 'sharedWith.role': { $in: ['editor', 'viewer'] } }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    report.attachments.push(...attachments);
    await report.save();

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment to report
app.post('/api/reports/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.uid;
    const user = await User.findById(userId);

    const report = await Report.findOne({
      _id: id,
      $or: [
        { visibility: 'public' },
        { visibility: 'team' },
        { 'sharedWith.user': userId },
        { 'author.id': userId }
      ]
    });

    if (!report) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }

    const comment = {
      author: {
        id: userId,
        name: user.name
      },
      content
    };

    report.comments.push(comment);
    await report.save();

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like/unlike a report
app.post('/api/reports/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.uid;

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const existingLike = report.likes.find(like => like.user.toString() === userId);
    
    if (existingLike) {
      report.likes.pull(existingLike._id);
    } else {
      report.likes.push({ user: userId });
    }

    await report.save();
    res.json({ liked: !existingLike, likesCount: report.likes.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Auth (local) ---
app.post('/api/auth', async (req, res) => {
  const { type, name, email, password, role } = req.body || {};
  if (type === 'signup') {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'User exists' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash, role: role || 'sales' });
    return res.status(201).json({ id: user._id });
  }
  if (type === 'login') {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ uid: user._id, role: user.role, code: user.code, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.status(200).json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        code: user.code 
      } 
    });
  }
  return res.status(400).json({ error: 'Unsupported type' });
});

// Dedicated login endpoint for easier use
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ 
      uid: user._id, 
      role: user.role, 
      code: user.code, 
      email: user.email 
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    return res.status(200).json({ 
      token, 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        code: user.code 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Create demo users (for testing)
app.post('/api/demo-users', async (req, res) => {
  try {
    // Check if demo users already exist
    const existingUsers = await User.find({ email: { $in: ['admin@example.com', 'manager@example.com', 'sales@example.com'] } });
    if (existingUsers.length > 0) {
      return res.json({ message: 'Demo users already exist', users: existingUsers });
    }

    const demoUsers = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin'
      },
      {
        name: 'Manager User',
        email: 'manager@example.com',
        password: 'manager123',
        role: 'manager'
      },
      {
        name: 'Sales User',
        email: 'sales@example.com',
        password: 'sales123',
        role: 'sales'
      }
    ];

    const createdUsers = [];
    for (const userData of demoUsers) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash,
        role: userData.role,
        code: userData.role.toUpperCase() + '001'
      });
      createdUsers.push({ id: user._id, name: user.name, email: user.email, role: user.role });
    }

    res.json({ message: 'Demo users created successfully', users: createdUsers });
  } catch (error) {
    console.error('Error creating demo users:', error);
    res.status(500).json({ error: 'Failed to create demo users' });
  }
});

// Map data endpoint
app.get('/api/map-data', requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    
    let data = {};
    
    if (!type || type === 'tasks') {
      // Get tasks with locations
      const tasks = await Task.find({ 
        location: { $exists: true, $ne: null },
        'location.coordinates': { $exists: true, $ne: null }
      }).populate('assignee.id', 'name email');
      
      data.tasks = tasks.map(task => ({
        id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        location: task.location,
        assignee: task.assignee?.id?.name || 'Unassigned'
      }));
    }
    
    if (!type || type === 'invoices') {
      // Get invoices with locations
      const invoices = await Invoice.find({ 
        location: { $exists: true, $ne: null }
      });
      
      data.invoices = invoices.map(invoice => ({
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        total: invoice.total,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        location: invoice.location
      }));
    }
    
    if (!type || type === 'reports') {
      // Get reports with locations
      const reports = await Report.find({ 
        location: { $exists: true, $ne: null }
      }).populate('author.id', 'name');
      
      data.reports = reports.map(report => ({
        id: report._id,
        title: report.title,
        description: report.description,
        type: report.type,
        location: report.location,
        author: report.author?.id?.name || 'Unknown'
      }));
    }
    
    res.json(data);
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

app.get('/api/users', requireAuth, async (_req, res) => {
  const docs = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 }).limit(100);
  res.json(docs);
});

app.get('/api/products', requireAuth, async (req, res) => {
  const { q, category } = req.query;
  const filter = {};
  if (q) filter.name = { $regex: String(q), $options: 'i' };
  if (category) filter.category = String(category);
  const docs = await Product.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

app.post('/api/products', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const doc = await Product.create(req.body);
  res.status(201).json(doc);
});

app.patch('/api/products/:id', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { id } = req.params;
  const doc = await Product.findByIdAndUpdate(id, req.body, { new: true });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

app.delete('/api/products/:id', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const { id } = req.params;
  const out = await Product.findByIdAndDelete(id);
  if (!out) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// --- Enhanced Task Management ---
app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const { status, assignee, priority, category } = req.query;
    const user = req.user;
    
    let filter = {};
    
    // Role-based filtering
    if (user.role === 'sales') {
      // Sales can only see their own tasks
      filter['assignee.id'] = user.uid;
    } else if (user.role === 'manager') {
      // Manager can see their team's tasks (need to implement team logic)
      // For now, show all tasks
    }
    // Admin can see all tasks (no filter)
    
    // Apply additional filters
    if (status) filter.status = status;
    if (assignee) filter['assignee.id'] = assignee;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    
    const docs = await Task.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('assignee.id', 'name code email')
      .populate('createdBy.id', 'name code email');
    
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { title, description, assigneeId, dueAt, priority, category, location } = req.body;
    const user = req.user;
    
    if (!title || !assigneeId) {
      return res.status(400).json({ error: 'Title and assignee are required' });
    }
    
    // Get assignee details
    const assignee = await User.findById(assigneeId);
    if (!assignee) {
      return res.status(400).json({ error: 'Assignee not found' });
    }
    
    const taskData = {
      title,
      description,
      assignee: {
        id: assignee._id,
        name: assignee.name,
        code: assignee.code,
        email: assignee.email
      },
      createdBy: {
        id: user.uid,
        name: user.name || 'Unknown',
        code: user.code || 'Unknown',
        email: user.email || 'Unknown'
      },
      dueAt: dueAt ? new Date(dueAt) : null,
      priority: priority || 'medium',
      category: category || 'general',
      location: location || null
    };
    
    const task = await Task.create(taskData);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const updates = req.body;
    
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check permissions
    if (user.role === 'sales' && task.assignee.id !== user.uid) {
      return res.status(403).json({ error: 'You can only update your own tasks' });
    }
    
    // Add update notification
    if (updates.status && updates.status !== task.status) {
      task.notifications.push({
        type: 'updated',
        message: `Task status changed to ${updates.status}`,
        read: false
      });
    }
    
    const updatedTask = await Task.findByIdAndUpdate(id, updates, { new: true });
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findByIdAndDelete(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment to task
app.post('/api/tasks/:id/comments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const user = req.user;
    
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const comment = {
      text,
      author: {
        id: user.uid,
        name: user.name || 'Unknown',
        code: user.code || 'Unknown'
      }
    };
    
    task.comments.push(comment);
    await task.save();
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user notifications
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { unread } = req.query;
    
    let filter = {};
    if (user.role === 'sales') {
      filter['assignee.id'] = user.uid;
    }
    
    if (unread === 'true') {
      filter['notifications.read'] = false;
    }
    
    const tasks = await Task.find(filter, { notifications: 1, title: 1, status: 1 });
    const notifications = tasks.flatMap(task => 
      task.notifications.map(notif => ({
        ...notif.toObject(),
        taskId: task._id,
        taskTitle: task.title,
        taskStatus: task.status
      }))
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark notification as read
app.patch('/api/notifications/:taskId/:notificationId', requireAuth, async (req, res) => {
  try {
    const { taskId, notificationId } = req.params;
    
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const notification = task.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    notification.read = true;
    await task.save();
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Dashboard Analytics (Simplified) ---
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const user = req.user;
    
    // Set date range (default to last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Simple queries instead of complex aggregations
    const [tasks, invoices, uploads, users] = await Promise.all([
      Task.find({ createdAt: { $gte: start, $lte: end } }).lean(),
      Invoice.find({ createdAt: { $gte: start, $lte: end } }).lean(),
      Upload.find({ createdAt: { $gte: start, $lte: end } }).lean(),
      User.find({}).lean()
    ]);
    
    // Calculate task stats (simple counting)
    const taskStats = {
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => t.status === 'overdue').length,
      cancelled: tasks.filter(t => t.status === 'cancelled').length
    };
    
    // Calculate sales stats (simple math)
    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.price || 0), 0);
    const totalInvoices = invoices.length;
    const averageInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;
    
    const salesStats = {
      totalRevenue,
      totalInvoices,
      averageInvoice
    };
    
    // Simple daily sales (last 7 days)
    const dailySales = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
      const dayInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.createdAt);
        return invDate.toDateString() === date.toDateString();
      });
      
      dailySales.push({
        _id: {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        },
        revenue: dayInvoices.reduce((sum, inv) => sum + (inv.price || 0), 0),
        count: dayInvoices.length
      });
    }
    
    // Simple employee activity
    const employeeActivity = users.slice(0, 5).map(user => ({
      _id: user._id,
      name: user.name,
      code: user.code,
      completedTasks: tasks.filter(t => t.assignee?.id === user._id && t.status === 'completed').length
    })).sort((a, b) => b.completedTasks - a.completedTasks);
    
    // Simple product performance (top 5)
    const productCount = {};
    invoices.forEach(inv => {
      productCount[inv.product] = (productCount[inv.product] || 0) + 1;
    });
    
    const productPerformance = Object.entries(productCount)
      .map(([product, count]) => ({
        _id: product,
        revenue: invoices.filter(inv => inv.product === product).reduce((sum, inv) => sum + (inv.price || 0), 0),
        count
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Simple location activity
    const locationCount = {};
    uploads.forEach(upload => {
      if (upload.coords) {
        const key = `${upload.coords.lat.toFixed(2)},${upload.coords.lng.toFixed(2)}`;
        locationCount[key] = (locationCount[key] || 0) + 1;
      }
    });
    
    const locationActivity = Object.entries(locationCount)
      .map(([coords, count]) => {
        const [lat, lng] = coords.split(',');
        return {
          _id: { lat: parseFloat(lat), lng: parseFloat(lng) },
          count,
          types: ['upload'] // Simplified
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    res.json({
      taskStats,
      salesStats,
      dailySales,
      employeeActivity,
      productPerformance,
      locationActivity,
      dateRange: { start, end }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent activity feed
app.get('/api/dashboard/activity', requireAuth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const user = req.user;
    
    let userFilter = {};
    if (user.role === 'sales') {
      userFilter = { 'assignee.id': user.uid };
    }
    
    // Get recent tasks
    const recentTasks = await Task.find(userFilter)
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit) / 2)
      .select('title status assignee updatedAt');
    
    // Get recent invoices
    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) / 2)
      .select('client product price createdAt');
    
    // Get recent uploads
    const recentUploads = await Upload.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) / 2)
      .select('type note user createdAt');
    
    // Combine and sort all activities
    const activities = [
      ...recentTasks.map(task => ({
        type: 'task',
        action: `Task "${task.title}" status changed to ${task.status}`,
        user: task.assignee.name,
        timestamp: task.updatedAt,
        data: task
      })),
      ...recentInvoices.map(invoice => ({
        type: 'invoice',
        action: `New invoice created for ${invoice.client}`,
        user: 'System',
        timestamp: invoice.createdAt,
        data: invoice
      })),
      ...recentUploads.map(upload => ({
        type: 'upload',
        action: `${upload.type} uploaded: ${upload.note || 'No note'}`,
        user: upload.user?.name || 'Unknown',
        timestamp: upload.createdAt,
        data: upload
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, parseInt(limit));
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// --- Enhanced Billing with PDF Generation ---
app.get('/api/invoices', requireAuth, async (_req, res) => {
  const docs = await Invoice.find().sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

// Generate PDF for invoice
app.get('/api/invoices/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Create HTML template for PDF
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice #${invoice._id}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #1f2937; }
          .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .invoice-info { flex: 1; }
          .client-info { flex: 1; text-align: right; }
          .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .invoice-table th, .invoice-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          .invoice-table th { background-color: #f9fafb; font-weight: bold; }
          .total-section { text-align: right; margin-top: 20px; }
          .total-amount { font-size: 18px; font-weight: bold; color: #059669; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
          .location-info { margin-top: 10px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">Sales Management System</div>
          <div style="margin-top: 5px; color: #6b7280;">Professional Invoice</div>
        </div>
        
        <div class="invoice-details">
          <div class="invoice-info">
            <h3>Invoice Details</h3>
            <p><strong>Invoice #:</strong> ${invoice._id}</p>
            <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date(invoice.createdAt).toLocaleTimeString()}</p>
            ${invoice.location?.lat && invoice.location?.lng ? 
              `<div class="location-info">
                <strong>Location:</strong> ${invoice.location.lat.toFixed(4)}, ${invoice.location.lng.toFixed(4)}
              </div>` : ''
            }
          </div>
          <div class="client-info">
            <h3>Bill To</h3>
            <p><strong>Client:</strong> ${invoice.client}</p>
            <p><strong>Email:</strong> ${invoice.emailTo || 'Not provided'}</p>
          </div>
        </div>
        
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Quantity</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${invoice.product}</td>
              <td>1</td>
              <td>GHS ${invoice.price.toFixed(2)}</td>
              <td>GHS ${invoice.price.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="total-section">
          <div class="total-amount">
            Total: GHS ${invoice.price.toFixed(2)}
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for your business!</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    // For now, return HTML (in production, use puppeteer to generate PDF)
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send invoice via email using SendGrid
app.post('/api/invoices/:id/email', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { to, subject, message } = req.body;
    
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Check if SendGrid API key is configured
    if (!process.env.SENDGRID_API_KEY) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email configuration not set up. Please configure SENDGRID_API_KEY in environment variables.' 
      });
    }

    // Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    // Generate invoice HTML
    const invoiceHTML = await generateInvoiceHTML(invoice);
    
    // Create professional email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice #${invoice._id.toString().slice(-8)}</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f8f9fa;
          }
          .container {
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 20px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .header p {
            margin: 5px 0 0 0;
            opacity: 0.9;
          }
          .content { 
            padding: 30px 20px; 
          }
          .invoice-details { 
            background-color: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
            border-left: 4px solid #667eea;
          }
          .footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #6c757d; 
            border-top: 1px solid #e9ecef;
          }
          .amount { 
            font-size: 24px; 
            font-weight: bold; 
            color: #28a745; 
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
          }
          .table td:first-child {
            font-weight: 600;
            color: #495057;
            width: 30%;
          }
          .message-box {
            background-color: #e3f2fd;
            border: 1px solid #2196f3;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
          }
          .message-box strong {
            color: #1976d2;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice #${invoice._id.toString().slice(-8)}</h1>
            <p>Sales Management System</p>
          </div>
          
          <div class="content">
            <p>Dear ${invoice.client},</p>
            <p>Thank you for your business! Please find your invoice details below:</p>
            
            <div class="invoice-details">
              <table class="table">
                <tr>
                  <td><strong>Product:</strong></td>
                  <td>${invoice.product}</td>
                </tr>
                <tr>
                  <td><strong>Amount:</strong></td>
                  <td class="amount">GHS ${invoice.price.toFixed(2)}</td>
                </tr>
                <tr>
                  <td><strong>Date:</strong></td>
                  <td>${new Date(invoice.createdAt).toLocaleDateString('en-GB', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</td>
                </tr>
                <tr>
                  <td><strong>Invoice ID:</strong></td>
                  <td>#${invoice._id.toString().slice(-8)}</td>
                </tr>
                ${invoice.location?.lat && invoice.location?.lng ? `
                <tr>
                  <td><strong>Location:</strong></td>
                  <td>${invoice.location.lat.toFixed(4)}, ${invoice.location.lng.toFixed(4)}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            ${message ? `
            <div class="message-box">
              <p><strong>Personal Message:</strong></p>
              <p>${message}</p>
            </div>
            ` : ''}
            
            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
          </div>
          
          <div class="footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>Best regards,<br>Sales Team<br>Sales Management System</p>
            <p style="font-size: 12px; margin-top: 20px; color: #adb5bd;">
              This email was generated automatically on ${new Date().toLocaleString('en-GB')}
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // SendGrid message configuration
    const msg = {
      to: to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@salesmgmt.com',
        name: 'Sales Management System'
      },
      subject: subject || `Invoice #${invoice._id.toString().slice(-8)} - ${invoice.product}`,
      html: emailHtml,
      attachments: [
        {
          content: Buffer.from(invoiceHTML).toString('base64'),
          filename: `invoice-${invoice._id.toString().slice(-8)}.html`,
          type: 'text/html',
          disposition: 'attachment'
        }
      ]
    };

    // Send email via SendGrid
    const response = await sgMail.send(msg);
    
    // Update invoice with email info
    invoice.emailTo = to;
    invoice.emailSent = true;
    invoice.emailSentAt = new Date();
    invoice.emailSubject = msg.subject;
    invoice.emailMessage = message;
    invoice.status = 'sent';
    await invoice.save();

    res.json({ 
      success: true, 
      message: 'Invoice sent successfully via SendGrid',
      messageId: response[0].headers['x-message-id'],
      recipient: to,
      statusCode: response[0].statusCode
    });

  } catch (error) {
    console.error('SendGrid email error:', error);
    
    // Handle SendGrid specific errors
    if (error.response) {
      const { body } = error.response;
      return res.status(500).json({ 
        success: false, 
        message: `SendGrid error: ${body.errors?.[0]?.message || 'Unknown SendGrid error'}` 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send email: ' + error.message 
    });
  }
});

// Helper function to generate invoice HTML
async function generateInvoiceHTML(invoice) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice #${invoice._id}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #1f2937; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .invoice-info { flex: 1; }
        .client-info { flex: 1; text-align: right; }
        .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .invoice-table th, .invoice-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        .invoice-table th { background-color: #f9fafb; font-weight: bold; }
        .total-section { text-align: right; margin-top: 20px; }
        .total-amount { font-size: 18px; font-weight: bold; color: #059669; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">Sales Management System</div>
        <div style="margin-top: 5px; color: #6b7280;">Professional Invoice</div>
      </div>
      
      <div class="invoice-details">
        <div class="invoice-info">
          <h3>Invoice Details</h3>
          <p><strong>Invoice #:</strong> ${invoice._id}</p>
          <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date(invoice.createdAt).toLocaleTimeString()}</p>
        </div>
        <div class="client-info">
          <h3>Bill To</h3>
          <p><strong>Client:</strong> ${invoice.client}</p>
        </div>
      </div>
      
      <table class="invoice-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${invoice.product}</td>
            <td>1</td>
            <td>GHS ${invoice.price.toFixed(2)}</td>
            <td>GHS ${invoice.price.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="total-section">
        <div class="total-amount">
          Total: GHS ${invoice.price.toFixed(2)}
        </div>
      </div>
      
      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>
    </body>
    </html>
  `;
}

app.post('/api/invoices', requireAuth, async (req, res) => {
  try {
    const { client, product, price, coords } = req.body;
    if (!client || !product || !price) {
      return res.status(400).json({ error: 'Client, product, and price are required' });
    }
    const inv = await Invoice.create({ client, product, price: Number(price), location: coords });
    res.status(201).json(inv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- Seed endpoints (idempotent-ish) ---
app.get('/api/seed/users', async (_req, res) => {
  try {
    const users = [
      { name: 'Admin One',   email: 'admin@example.com',   password: 'Admin#123',   role: 'admin' },
      { name: 'Manager One', email: 'manager@example.com', password: 'Manager#123', role: 'manager' },
      { name: 'Rep One',     email: 'rep1@example.com',    password: 'Rep#123',     role: 'sales' },
      { name: 'Rep Two',     email: 'rep2@example.com',    password: 'Rep#123',     role: 'sales' }
    ];
    const created = [];
    for (const u of users) {
      const exists = await User.findOne({ email: u.email });
      if (exists) {
        created.push(u.email + ' (exists)');
        continue;
      }
      const passwordHash = await bcrypt.hash(u.password, 10);
      const doc = await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
      created.push(doc.email);
    }
    res.json({ inserted: created.length, emails: created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/seed/products', async (_req, res) => {
  const items = [
    { name: 'Orange Juice 500ml', category: 'Beverages', price: 9.99, details: '12-pack', attributes: { size_ml: 500, brand: 'BrandA' } },
    { name: 'Apple Juice 1L',     category: 'Beverages', price: 14.5, details: '6-pack',  attributes: { size_ml: 1000, brand: 'BrandA' } },
    { name: 'Potato Chips',       category: 'Snacks',    price: 3.5,  details: 'Salted',  attributes: { brand: 'BrandB' } }
  ];
  const ops = await Product.insertMany(items, { ordered: false });
  res.json({ inserted: ops.length });
});

app.get('/api/seed/tasks', async (_req, res) => {
  const items = [
    { title: 'Visit Market Cluster 1', description: 'Check promo stand', assignee: 'rep1@example.com', dueAt: new Date(Date.now() + 864e5) },
    { title: 'Invoice Customer X',     description: 'After delivery',    assignee: 'rep2@example.com' }
  ];
  const ops = await Task.insertMany(items, { ordered: false });
  res.json({ inserted: ops.length });
});

// --- Categories CRUD ---
app.get('/api/categories', async (_req, res) => {
  const docs = await Category.find().sort({ createdAt: -1 }).limit(200);
  res.json(docs);
});

app.post('/api/categories', async (req, res) => {
  const doc = await Category.create(req.body);
  res.status(201).json(doc);
});

app.patch('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const doc = await Category.findByIdAndUpdate(id, req.body, { new: true });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  res.json(doc);
});

app.delete('/api/categories/:id', async (req, res) => {
  const { id } = req.params;
  const out = await Category.findByIdAndDelete(id);
  if (!out) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

app.get('/api/seed/categories', async (_req, res) => {
  const items = [
    { name: 'Beverages', fields: [ { key: 'brand', type: 'dropdown', options: ['BrandA','BrandB'] }, { key: 'size_ml', type: 'number' } ] },
    { name: 'Snacks', fields: [ { key: 'brand', type: 'dropdown', options: ['BrandB','BrandC'] } ] }
  ];
  const ops = await Category.insertMany(items, { ordered: false });
  res.json({ inserted: ops.length });
});

app.get('/api/seed/invoices', async (_req, res) => {
  const items = [
    { client: 'John Doe', product: 'Orange Juice 500ml', price: 9.99 },
    { client: 'Jane Smith', product: 'Apple Juice 1L', price: 14.50 },
    { client: 'Bob Johnson', product: 'Potato Chips', price: 3.50 }
  ];
  const ops = await Invoice.insertMany(items, { ordered: false });
  res.json({ inserted: ops.length });
});

// --- Uploads ---
app.post('/api/uploads', requireAuth, async (req, res) => {
  try {
    const { type, note, taskId, mediaUrl, coords } = req.body || {};
    const doc = await Upload.create({
      type, note, taskId, mediaUrl, coords,
      user: { id: req.user.uid, email: req.user.email, code: req.user.code }
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/uploads', requireAuth, async (_req, res) => {
  const docs = await Upload.find().sort({ createdAt: -1 }).limit(100);
  res.json(docs);
});

// --- Media Upload with R2 ---
app.post('/api/media-upload', requireAuth, async (req, res) => {
  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });

    const { type, note, taskId, coords, user } = req.body || {};
    if (!type || !user) return res.status(400).json({ error: 'type and user required' });

    // Generate presigned URL for direct upload to R2
    const key = `uploads/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: getContentType(type),
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    
    // Save upload record with presigned URL
    const upload = await Upload.create({
      type,
      note,
      taskId,
      mediaUrl: publicUrl,
      coords,
      user: { id: user.id, email: user.email, code: user.code }
    });
    
    res.status(201).json({ 
      uploadId: upload._id,
      uploadUrl,
      publicUrl,
      key 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getContentType(type) {
  const types = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/mpeg',
    note: 'text/plain'
  };
  return types[type] || 'application/octet-stream';
}

// --- Voice Transcription ---
app.post('/api/media-transcribe', requireAuth, async (req, res) => {
  try {
    const { uploadId, audioUrl } = req.body || {};
    if (!uploadId || !audioUrl) return res.status(400).json({ error: 'uploadId and audioUrl required' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Transcribe audio using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioUrl,
      model: 'whisper-1',
    });
    
    // Update upload with transcription
    const upload = await Upload.findByIdAndUpdate(
      uploadId,
      { transcript: transcription.text },
      { new: true }
    );
    
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    
    res.status(200).json({ 
      transcript: transcription.text,
      upload 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Server startup is handled above at line 39

