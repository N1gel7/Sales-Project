import { dbConnect } from './_lib/db.js';
import Category from '../models/Category.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json(categories);
  }
  
  if (req.method === 'POST') {
    const category = await Category.create(req.body);
    return res.status(201).json(category);
  }
  
  if (req.method === 'PUT') {
    const { id, ...updateData } = req.body;
    const category = await Category.findByIdAndUpdate(id, updateData, { new: true });
    if (!category) return res.status(404).json({ error: 'Category not found' });
    return res.status(200).json(category);
  }
  
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const category = await Category.findByIdAndDelete(id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    return res.status(200).json({ message: 'Category deleted successfully' });
  }
  
  return res.status(405).end();
}
