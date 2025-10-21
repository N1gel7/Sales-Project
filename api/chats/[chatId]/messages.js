import { dbConnect } from './_lib/db.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  const { chatId } = req.query;
  
  if (req.method === 'GET') {
    // For now, return empty array since we don't have a messages model
    // This can be extended later when chat system is implemented
    const messages = [];
    res.json(messages);
  } else if (req.method === 'POST') {
    const { content, type } = req.body || {};
    
    // For now, just return a mock response
    const message = {
      _id: `msg_${Date.now()}`,
      chatId,
      content,
      type: type || 'text',
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json(message);
  } else if (req.method === 'PUT') {
    // Mark chat as read
    res.json({ success: true });
  }
  
  return res.status(405).end();
}
