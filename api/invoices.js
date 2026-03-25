export default async function handler(req, res) {
  const mockInvoices = [
    { _id: 'inv_1', client: 'Client A', product: 'Branding Package', price: 1500, status: 'paid', createdAt: new Date().toISOString() },
    { _id: 'inv_2', client: 'Client B', product: 'Web Development', price: 3500, status: 'sent', createdAt: new Date().toISOString() },
    { _id: 'inv_3', client: 'Client C', product: 'SEO Audit', price: 500, status: 'overdue', createdAt: new Date().toISOString() }
  ];

  if (req.method === 'GET') {
    return res.status(200).json(mockInvoices);
  }
  
  if (req.method === 'POST') {
    return res.status(201).json({ ...req.body, _id: `inv_${Date.now()}`, createdAt: new Date().toISOString() });
  }
  
  return res.status(405).end();
}
