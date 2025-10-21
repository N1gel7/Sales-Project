import { dbConnect } from './_lib/db.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    // For now, return empty array since we don't have a chats model
    // This can be extended later when chat system is implemented
    const chats = [];
    res.json(chats);
  } else if (req.method === 'POST') {
    const { name, type, participants } = req.body || {};
    
    // For now, just return a mock response
    const chat = {
      _id: `chat_${Date.now()}`,
      name,
      type,
      participants,
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json(chat);
  }
  
  return res.status(405).end();
}
