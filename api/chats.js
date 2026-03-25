export default async function handler(req, res) {
  const { method, url } = req;
  const urlParts = url.split('/');
  // /api/chats
  // /api/chats/[id]/messages
  
  const mockUsers = [
    { _id: 'user_admin', name: 'Admin User', role: 'admin' },
    { _id: 'user_manager', name: 'Manager User', role: 'manager' },
    { _id: 'user_rep1', name: 'Sales Rep', role: 'sales' }
  ];

  const mockChats = [
    {
      _id: 'chat_1',
      name: 'Sales Team',
      type: 'group',
      participants: [
        { user: mockUsers[0], role: 'admin', joinedAt: new Date().toISOString() },
        { user: mockUsers[2], role: 'member', joinedAt: new Date().toISOString() }
      ],
      lastMessage: { content: 'Welcome to the team!', sender: mockUsers[0], sentAt: new Date().toISOString() },
      isActive: true,
      createdBy: mockUsers[0]
    }
  ];

  const mockMessages = [
    {
      _id: 'msg_1',
      sender: { id: 'user_admin', name: 'Admin User', role: 'admin' },
      content: 'Hello everyone!',
      type: 'text',
      readBy: [],
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      _id: 'msg_2',
      sender: { id: 'user_admin', name: 'Admin User', role: 'admin' },
      content: 'Welcome to the team!',
      type: 'text',
      readBy: [],
      createdAt: new Date().toISOString()
    }
  ];

  if (url === '/api/chats') {
    if (method === 'GET') return res.json(mockChats);
    if (method === 'POST') return res.status(201).json({ ...req.body, _id: `chat_${Date.now()}` });
  }

  if (url.includes('/messages')) {
    if (method === 'GET') return res.json(mockMessages);
    if (method === 'POST') return res.status(201).json({ ...req.body, _id: `msg_${Date.now()}`, createdAt: new Date().toISOString(), sender: { id: 'user_rep1', name: 'Sales Rep' } });
  }

  return res.status(200).json([]);
}
