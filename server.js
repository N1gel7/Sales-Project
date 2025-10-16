import 'dotenv/config';
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
    const token = jwt.sign({ uid: user._id, role: user.role, code: user.code }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
  const inv = await Invoice.create(req.body);
  res.status(201).json(inv);
});

// --- Seed endpoints (idempotent-ish) ---
app.get('/api/seed/users', async (_req, res) => {
  const users = [
    { name: 'Admin One',   email: 'admin@example.com',   password: 'Admin#123',   role: 'admin' },
    { name: 'Manager One', email: 'manager@example.com', password: 'Manager#123', role: 'manager' },
    { name: 'Rep One',     email: 'rep1@example.com',    password: 'Rep#123',     role: 'sales' },
    { name: 'Rep Two',     email: 'rep2@example.com',    password: 'Rep#123',     role: 'sales' }
  ];
  const created = [];
  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) continue;
    const passwordHash = await bcrypt.hash(u.password, 10);
    const doc = await User.create({ name: u.name, email: u.email, passwordHash, role: u.role });
    created.push(doc.email);
  }
  res.json({ inserted: created.length, emails: created });
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


