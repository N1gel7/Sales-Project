import { dbConnect } from './_lib/db.js';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
  if (req.method === 'GET') {
    // For now, return empty array since we don't have a reports model
    // This can be extended later when reports system is implemented
    const reports = [];
    res.json(reports);
  } else if (req.method === 'POST') {
    const reportData = req.body || {};
    
    // For now, just return a mock response
    const report = {
      _id: `report_${Date.now()}`,
      ...reportData,
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json(report);
  }
  
  return res.status(405).end();
}
