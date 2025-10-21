import { dbConnect } from './_lib/db.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const { q, category } = req.query || {};
    const filter = {};
    if (q) filter.name = { $regex: String(q), $options: 'i' };
    if (category) filter.category = String(category);
    const docs = await Product.find(filter).populate('category', 'name').sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(docs);
  }
  
  if (req.method === 'POST') {
    const doc = await Product.create(req.body);
    await doc.populate('category', 'name');
    return res.status(201).json(doc);
  }
  
  if (req.method === 'PUT') {
    const { id, ...updateData } = req.body;
    const doc = await Product.findByIdAndUpdate(id, updateData, { new: true }).populate('category', 'name');
    if (!doc) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json(doc);
  }
  
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const doc = await Product.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Product not found' });
    return res.status(200).json({ message: 'Product deleted successfully' });
  }
  
  return res.status(405).end();
}
