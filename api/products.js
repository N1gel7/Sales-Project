export default async function handler(req, res) {
  const mockProducts = [
    { _id: 'prod_1', name: 'Smartphone X', price: 999.99, category: 'Electronics', createdAt: new Date().toISOString() },
    { _id: 'prod_2', name: 'Laptop Pro', price: 1499.99, category: 'Electronics', createdAt: new Date().toISOString() },
    { _id: 'prod_3', name: 'Desk Chair', price: 199.99, category: 'Furniture', createdAt: new Date().toISOString() }
  ];

  if (req.method === 'GET') {
    return res.status(200).json(mockProducts);
  }
  
  if (req.method === 'POST') {
    return res.status(201).json({ ...req.body, _id: `prod_${Date.now()}` });
  }
  
  if (req.method === 'PUT') {
    return res.status(200).json({ ...req.body });
  }
  
  if (req.method === 'DELETE') {
    return res.status(200).json({ message: 'Product deleted' });
  }
  
  return res.status(405).end();
}
