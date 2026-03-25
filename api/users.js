export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  const mockUsers = [
    { _id: 'user_admin', name: 'Admin User', email: 'admin@example.com', code: 'ADM001', role: 'admin' },
    { _id: 'user_manager', name: 'Manager User', email: 'manager@example.com', code: 'MGR001', role: 'manager' },
    { _id: 'user_rep1', name: 'Sales Rep', email: 'rep1@example.com', code: 'SAL001', role: 'sales' }
  ];
  
  return res.status(200).json(mockUsers);
}
