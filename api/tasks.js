import { dbConnect } from './_lib/db.js';
import Task from '../models/Task.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  if (req.method === 'GET') {
    const docs = await Task.find().sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(docs);
  }
  if (req.method === 'POST') {
    const t = await Task.create(req.body);
    return res.status(201).json(t);
  }
  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    const t = await Task.findByIdAndUpdate(id, { status }, { new: true });
    return res.status(200).json(t);
  }
  return res.status(405).end();
}


