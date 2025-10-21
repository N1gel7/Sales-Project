import { dbConnect } from './_lib/db.js';
import Invoice from '../models/Invoice.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const docs = await Invoice.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(docs);
  }
  
  if (req.method === 'POST') {
    const doc = await Invoice.create(req.body);
    await doc.populate('user', 'name email');
    return res.status(201).json(doc);
  }
  
  if (req.method === 'PUT') {
    const { id, ...updateData } = req.body;
    const doc = await Invoice.findByIdAndUpdate(id, updateData, { new: true }).populate('user', 'name email');
    if (!doc) return res.status(404).json({ error: 'Invoice not found' });
    return res.status(200).json(doc);
  }
  
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const doc = await Invoice.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Invoice not found' });
    return res.status(200).json({ message: 'Invoice deleted successfully' });
  }
  
  return res.status(405).end();
}
