import { dbConnect } from './_lib/db.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    const { unread } = req.query;
    
    // For now, return empty array since we don't have a notifications model
    // This can be extended later when notification system is implemented
    const notifications = [];
    
    res.json(notifications);
  } else if (req.method === 'PATCH') {
    const { taskId, notificationId } = req.query;
    
    // For now, just return success since we don't have notifications implemented
    res.json({ success: true });
  }
  
  return res.status(405).end();
}
