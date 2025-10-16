import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import Product from './models/Product.js';
import Task from './models/Task.js';
import Invoice from './models/Invoice.js';
import User from './models/User.js';
import Category from './models/Category.js';
import Upload from './models/Upload.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.API_PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { dbName: 'sample_mfix' }).then(() => {
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}).catch((e) => console.error('Mongo error:', e));

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

app.get('/api/users', requireAuth, requireRole('admin', 'manager'), async (_req, res) => {
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

app.get('/api/tasks', requireAuth, async (_req, res) => {
  const docs = await Task.find().sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

app.post('/api/tasks', requireAuth, async (req, res) => {
  const t = await Task.create(req.body);
  res.status(201).json(t);
});

app.patch('/api/tasks', requireAuth, async (req, res) => {
  const { id, status } = req.body || {};
  const t = await Task.findByIdAndUpdate(id, { status }, { new: true });
  res.json(t);
});

app.get('/api/invoices', requireAuth, async (_req, res) => {
  const docs = await Invoice.find().sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

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
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
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

    const { default: OpenAI } = await import('openai');
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


