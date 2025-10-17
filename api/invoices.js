import { dbConnect } from './_lib/db.js';
import Invoice from '../models/Invoice.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  if (req.method === 'GET') {
    const docs = await Invoice.find().sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(docs);
  }
  if (req.method === 'POST') {
    const inv = await Invoice.create(req.body);
    return res.status(201).json(inv);
  }
  return res.status(405).end();
}


