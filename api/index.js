const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const OpenAI = require('openai');

const User = require('../models/User');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Task = require('../models/Task');
const Invoice = require('../models/Invoice');
const Upload = require('../models/Upload');
const Activity = require('../models/Activity');
const Chat = require('../models/Chat');
const Report = require('../models/Report');

const app = express();

// Restore /api prefix for Vercel serverless functions
if (process.env.VERCEL) {
  app.use((req, _res, next) => {
    if (!req.url.startsWith('/api')) req.url = '/api' + req.url;
    next();
  });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
app.use(express.static('public'));


const s3Client = process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY ? new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
}) : null;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MONGODB_URI = process.env.MONGODB_URI;

if (!global.mongoose) {
  global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (global.mongoose.conn) {
    return global.mongoose.conn;
  }

  if (!global.mongoose.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    global.mongoose.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    global.mongoose.conn = await global.mongoose.promise;
  } catch (e) {
    global.mongoose.promise = null;
    throw e;
  }

  return global.mongoose.conn;
}

app.use(async (req, res, next) => {
  try {
    await dbConnect();
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Helper function to upload file to R2
async function uploadToR2(file, key) {
  if (!s3Client) {
    throw new Error('S3/R2 client not configured');
  }
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });
  return await s3Client.send(command);
}

// Helper function to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Helper function to format date
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


app.post(['/api/login', '/login'], async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { uid: user._id, role: user.role, code: user.code, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, code: user.code, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(['/api/signup', '/signup'], async (req, res) => {
  try {
    const { name, email, password, role, code } = req.body;
    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email: email.toLowerCase(),
      passwordHash: hashedPassword,
      role: role || 'sales',
      code: code || `SS${Date.now().toString().slice(-6)}`
    });
    
    await user.save();
    
    const token = jwt.sign(
      { uid: user._id, role: user.role, code: user.code, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({ token, user: { id: user._id, name: user.name, role: user.role, code: user.code, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate, userId } = req.query;
    const user = req.user;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
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


app.get('/api/products', requireAuth, async (req, res) => {
  try {
    const products = await Product.find().populate('category', 'name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    await product.populate('category', 'name');
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('category', 'name');
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categories', requireAuth, async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', requireAuth, async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/tasks', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let filter = {};
    
    if (user.role === 'sales') {
      filter = { 'assignee.id': user.uid };
    }
    
    const tasks = await Task.find(filter).populate('assignee.id', 'name email').sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    await task.populate('assignee.id', 'name email');
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('assignee.id', 'name email');
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/uploads', requireAuth, async (req, res) => {
  try {
    const uploads = await Upload.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json(uploads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/uploads', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { type, note, coords, client } = req.body;
    const userId = req.user.uid;
    
    let fileUrl = null;
    if (req.file) {
      // For now, store files locally in public/uploads
      const fs = require('fs');
      const path = require('path');
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../public/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate unique filename
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);
      
      // Save file to disk
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Set public URL
      fileUrl = `/uploads/${fileName}`;
    }
    
    const upload = new Upload({
      type,
      note,
      fileUrl,
      transcriptStatus: type === 'audio' ? 'pending' : undefined,
      coords: coords ? JSON.parse(coords) : null,
      client: client ? JSON.parse(client) : null,
      user: userId
    });
    
    await upload.save();
    await upload.populate('user', 'name email');
    res.status(201).json(upload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transcribe media
app.post('/api/uploads/transcribe', requireAuth, async (req, res) => {
  try {
    const { fileUrl } = req.body;
    
    if (!fileUrl) {
      return res.status(400).json({ error: 'File URL is required' });
    }
    
    // Read the file from local storage
    const fs = require('fs');
    const path = require('path');
    
    // Convert relative URL to file path
    const fileName = fileUrl.replace('/uploads/', '');
    const filePath = path.join(__dirname, '../public/uploads', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }
    
    const audioBuffer = fs.readFileSync(filePath);
    
    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' }),
      model: 'whisper-1',
    });
    
    // Find and update the upload record with the transcription
    const upload = await Upload.findOne({ fileUrl: fileUrl });
    if (upload) {
      upload.transcriptStatus = 'processing';
      await upload.save();
      
      upload.transcript = transcription.text;
      upload.transcriptStatus = 'completed';
      await upload.save();
    }
    
    res.json({ transcription: transcription.text });
  } catch (error) {
    // Update status to failed if transcription fails
    try {
      const upload = await Upload.findOne({ fileUrl: req.body.fileUrl });
      if (upload) {
        upload.transcriptStatus = 'failed';
        await upload.save();
      }
    } catch (dbError) {
      console.error('Failed to update transcript status:', dbError);
    }
    
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/invoices', requireAuth, async (req, res) => {
  try {
    const invoices = await Invoice.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/invoices', requireAuth, async (req, res) => {
  try {
    const invoice = new Invoice({
      ...req.body,
      user: req.user.uid
    });
    await invoice.save();
    await invoice.populate('user', 'name email');
    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('user', 'name email');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/api/chats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const chats = await Chat.find({
      'participants.user': userId
    }).populate('participants.user', 'name email role').populate('createdBy', 'name').sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat.messages || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;
    const userId = req.user.uid;
    
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    const message = {
      content,
      type,
      sender: userId,
      timestamp: new Date()
    };
    
    chat.messages.push(message);
    await chat.save();
    
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/chats/:id/read', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const chat = await Chat.findById(req.params.id);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Update last read timestamp for user
    const participant = chat.participants.find(p => p.user.toString() === userId);
    if (participant) {
      participant.lastRead = new Date();
      await chat.save();
    }
    
    res.json({ message: 'Chat marked as read' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reports = await Report.find().populate('author.id', 'name role').sort({ createdAt: -1 });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

// Add attachment to report
app.post('/api/reports/:id/attachments', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    let fileUrl = null;
    if (req.file) {
      // Store files locally in public/uploads
      const fs = require('fs');
      const path = require('path');
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../public/uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // Generate unique filename
      const fileName = `report-${req.params.id}-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);
      
      // Save file to disk
      fs.writeFileSync(filePath, req.file.buffer);
      
      // Set public URL
      fileUrl = `/uploads/${fileName}`;
    }
    
    report.attachments.push({
      filename: req.file.originalname,
      url: fileUrl,
      uploadedBy: req.user.uid,
      uploadedAt: new Date()
    });
    
    await report.save();
    res.json({ message: 'Attachment added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment to report
app.post('/api/reports/:id/comments', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const comment = {
      content,
      author: {
        id: req.user.uid,
        name: req.user.name
      },
      createdAt: new Date()
    };
    
    report.comments.push(comment);
    await report.save();
    
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like/unlike report
app.post('/api/reports/:id/like', requireAuth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const userId = req.user.uid;
    const existingLike = report.likes.find(like => like.user === userId);
    
    if (existingLike) {
      report.likes = report.likes.filter(like => like.user !== userId);
    } else {
      report.likes.push({
        user: userId,
        likedAt: new Date()
      });
    }
    
    await report.save();
    res.json({ message: existingLike ? 'Report unliked' : 'Report liked' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SEED DATA ROUTE =====

// Seed initial data
app.post('/api/seed', async (req, res) => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Category.deleteMany({});
    await Task.deleteMany({});
    await Invoice.deleteMany({});
    await Upload.deleteMany({});
    await Activity.deleteMany({});
    await Chat.deleteMany({});
    await Report.deleteMany({});
    
    // Create categories
    const categories = await Category.insertMany([
      { name: 'Electronics', description: 'Electronic products and gadgets' },
      { name: 'Clothing', description: 'Apparel and fashion items' },
      { name: 'Home & Garden', description: 'Home improvement and garden supplies' },
      { name: 'Sports', description: 'Sports equipment and accessories' },
      { name: 'Books', description: 'Books and educational materials' }
    ]);
    
    // Create users
    const users = await User.insertMany([
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: await bcrypt.hash('Admin#123', 10),
        role: 'admin',
        code: 'AA001'
      },
      {
        name: 'Manager User',
        email: 'manager@example.com',
        password: await bcrypt.hash('Manager#123', 10),
        role: 'manager',
        code: 'MM001'
      },
      {
        name: 'Sales Rep 1',
        email: 'rep1@example.com',
        password: await bcrypt.hash('Rep#123', 10),
        role: 'sales',
        code: 'SS001'
      },
      {
        name: 'Sales Rep 2',
        email: 'rep2@example.com',
        password: await bcrypt.hash('Rep#123', 10),
        role: 'sales',
        code: 'SS002'
      }
    ]);
    
s
    const products = await Product.insertMany([
      {
        name: 'Wireless Headphones',
        description: 'High-quality wireless headphones with noise cancellation',
        price: 199.99,
        category: categories[0]._id,
        sku: 'WH-001',
        stock: 50
      },
      {
        name: 'Smart Watch',
        description: 'Fitness tracking smartwatch with heart rate monitor',
        price: 299.99,
        category: categories[0]._id,
        sku: 'SW-001',
        stock: 30
      },
      {
        name: 'Cotton T-Shirt',
        description: 'Comfortable cotton t-shirt in various colors',
        price: 24.99,
        category: categories[1]._id,
        sku: 'CT-001',
        stock: 100
      }
    ]);
    
s
    const tasks = await Task.insertMany([
      {
        title: 'Visit downtown client',
        description: 'Meet with ABC Corp to discuss new product line',
        status: 'pending',
        priority: 'high',
        assignee: { id: users[2]._id, name: users[2].name },
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'Follow up on invoice',
        description: 'Call XYZ Ltd about outstanding payment',
        status: 'in_progress',
        priority: 'medium',
        assignee: { id: users[2]._id, name: users[2].name },
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      },
      {
        title: 'Prepare quarterly report',
        description: 'Compile sales data for Q1 report',
        status: 'completed',
        priority: 'high',
        assignee: { id: users[1]._id, name: users[1].name },
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ]);
    
s
    const invoices = await Invoice.insertMany([
      {
        client: 'ABC Corporation',
        product: 'Wireless Headphones',
        quantity: 10,
        price: 1999.90,
        user: users[2]._id,
        status: 'paid'
      },
      {
        client: 'XYZ Ltd',
        product: 'Smart Watch',
        quantity: 5,
        price: 1499.95,
        user: users[2]._id,
        status: 'pending'
      },
      {
        client: 'DEF Inc',
        product: 'Cotton T-Shirt',
        quantity: 50,
        price: 1249.50,
        user: users[3]._id,
        status: 'paid'
      }
    ]);
    
    res.json({ 
      message: 'Database seeded successfully',
      counts: {
        users: users.length,
        categories: categories.length,
        products: products.length,
        tasks: tasks.length,
        invoices: invoices.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/api/test-db', async (req, res) => {
  try {
    await dbConnect();
    const userCount = await User.countDocuments();
    res.json({ 
      status: 'DB Connected', 
      userCount,
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'DB Connection Failed', 
      message: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

module.exports = app;
