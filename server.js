import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';

import Product from './models/Product.js';
import Task from './models/Task.js';
import Invoice from './models/Invoice.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.API_PORT || 4000;
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { dbName: 'sample_mfix' }).then(() => {
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}).catch((e) => console.error('Mongo error:', e));

app.get('/api/ping', (_req, res) => res.json({ ok: true }));

app.get('/api/products', async (req, res) => {
  const { q, category } = req.query;
  const filter = {};
  if (q) filter.name = { $regex: String(q), $options: 'i' };
  if (category) filter.category = String(category);
  const docs = await Product.find(filter).sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

app.post('/api/products', async (req, res) => {
  const doc = await Product.create(req.body);
  res.status(201).json(doc);
});

app.get('/api/tasks', async (_req, res) => {
  const docs = await Task.find().sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

app.post('/api/tasks', async (req, res) => {
  const t = await Task.create(req.body);
  res.status(201).json(t);
});

app.patch('/api/tasks', async (req, res) => {
  const { id, status } = req.body || {};
  const t = await Task.findByIdAndUpdate(id, { status }, { new: true });
  res.json(t);
});

app.get('/api/invoices', async (_req, res) => {
  const docs = await Invoice.find().sort({ createdAt: -1 }).limit(50);
  res.json(docs);
});

app.post('/api/invoices', async (req, res) => {
  const inv = await Invoice.create(req.body);
  res.status(201).json(inv);
});


