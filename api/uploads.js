import { dbConnect } from './_lib/db.js';
import Upload from '../models/Upload.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const uploads = await Upload.find().populate('user', 'name email').sort({ createdAt: -1 }).limit(50);
    return res.status(200).json(uploads);
  }
  
  if (req.method === 'POST') {
    const upload = await Upload.create(req.body);
    await upload.populate('user', 'name email');
    return res.status(201).json(upload);
  }
  
  if (req.method === 'DELETE') {
    const { id } = req.query;
    const upload = await Upload.findByIdAndDelete(id);
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    return res.status(200).json({ message: 'Upload deleted successfully' });
  }
  
  return res.status(405).end();
}
