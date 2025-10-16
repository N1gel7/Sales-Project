import { dbConnect } from './_lib/db.js';
import Product from '../models/Product.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  if (req.method === 'GET') {
    const { q, category } = req.query || {};
    const filter = {};
    if (q) filter.name = { $regex: String(q), $options: 'i' };
    if (category) filter.category = String(category);
    const docs = await Product.find(filter).sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(docs);
  }
  if (req.method === 'POST') {
    const doc = await Product.create(req.body);
    return res.status(201).json(doc);
  }
  return res.status(405).end();
}


