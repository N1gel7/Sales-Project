export default async function handler(req, res) {
  // Mock tasks data
  const mockTasks = [
    {
      _id: 'task_1',
      title: 'Follow up with Client A',
      description: 'Discuss the new product proposal.',
      status: 'pending',
      priority: 'high',
      category: 'Sales',
      assignee: { id: 'user_admin', name: 'Admin User', email: 'admin@example.com' },
      createdAt: new Date().toISOString(),
      comments: []
    },
    {
      _id: 'task_2',
      title: 'Review Quarterly Reports',
      description: 'Prepare for the management meeting.',
      status: 'in_progress',
      priority: 'medium',
      category: 'Management',
      assignee: { id: 'user_manager', name: 'Manager User', email: 'manager@example.com' },
      createdAt: new Date().toISOString(),
      comments: []
    },
    {
      _id: 'task_3',
      title: 'Update Inventory List',
      description: 'Check stock levels for Q2.',
      status: 'completed',
      priority: 'low',
      category: 'Operations',
      assignee: { id: 'user_rep1', name: 'Sales Rep', email: 'rep1@example.com' },
      createdAt: new Date().toISOString(),
      comments: []
    }
  ];

  if (req.method === 'GET') {
    return res.status(200).json(mockTasks);
  }
  
  if (req.method === 'POST') {
    const newTask = { ...req.body, _id: `task_${Date.now()}`, createdAt: new Date().toISOString() };
    return res.status(201).json(newTask);
  }
  
  if (req.method === 'PUT') {
    return res.status(200).json({ ...req.body, updatedAt: new Date().toISOString() });
  }
  
  if (req.method === 'DELETE') {
    return res.status(200).json({ message: 'Task deleted successfully (mock)' });
  }
  
  return res.status(405).end();
}
