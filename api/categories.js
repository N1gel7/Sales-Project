import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const mockCategories = [
    { _id: 'cat_1', name: 'Electronics' },
    { _id: 'cat_2', name: 'Furniture' },
    { _id: 'cat_3', name: 'Clothing' }
  ];

  if (req.method === 'GET') {
    return res.status(200).json(mockCategories);
  }
  
  if (req.method === 'POST') {
    return res.status(201).json({ ...req.body, _id: `cat_${Date.now()}` });
  }
  
  return res.status(405).end();
}


export default withAuth(handler);
