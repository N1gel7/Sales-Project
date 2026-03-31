import { withAuth } from '../_lib/authMiddleware.js';

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const activities = [
    { _id: 'act_1', type: 'task', action: 'Task "Client Follow-up" completed', user: 'Admin User', timestamp: new Date().toISOString(), status: 'completed' },
    { _id: 'act_2', type: 'invoice', action: 'Invoice created for Acme Corp', user: 'System', timestamp: new Date().toISOString(), amount: 1200 },
    { _id: 'act_3', type: 'upload', action: 'File uploaded: proposal.pdf', user: 'Manager User', timestamp: new Date().toISOString(), filename: 'proposal.pdf' },
    { _id: 'act_4', type: 'task', action: 'Task "Inventory Audit" started', user: 'Sales Rep', timestamp: new Date().toISOString(), status: 'in_progress' }
  ];
  
  return res.json(activities);
}


export default withAuth(handler);
