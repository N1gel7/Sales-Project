import { dbConnect } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      await dbConnect(process.env.MONGODB_URI);
      res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'ERROR', 
        timestamp: new Date().toISOString(),
        error: error.message 
      });
    }
  }
  
  return res.status(405).end();
}
