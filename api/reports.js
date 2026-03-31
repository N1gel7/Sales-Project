import { withAuth } from './_lib/authMiddleware.js';

async function handler(req, res) {
  const { method, url } = req;
  
  const mockReports = [
    {
      _id: 'rep_1',
      title: 'Monthly Sales Summary',
      description: 'Overview of sales performance for March 2026.',
      type: 'sales_report',
      author: { id: 'user_admin', name: 'Admin User', role: 'admin' },
      attachments: [],
      tags: ['sales', 'monthly'],
      status: 'published',
      visibility: 'team',
      comments: [],
      likes: [],
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'rep_2',
      title: 'Store Layout Mood Board',
      description: 'Inspiration for the new outlet in Kumasi.',
      type: 'mood_board',
      author: { id: 'user_rep1', name: 'Sales Rep', role: 'sales' },
      attachments: [
        { filename: 'inspiration.jpg', url: 'https://images.unsplash.com/photo-1534452203293-497d1ad262c2?w=400&h=400&fit=crop', type: 'image/jpeg', size: 1024 }
      ],
      tags: ['design', 'kumasi'],
      status: 'published',
      visibility: 'team',
      comments: [
        { _id: 'comm_1', author: { id: 'user_admin', name: 'Admin User' }, content: 'Looks great!', createdAt: new Date().toISOString() }
      ],
      likes: [{ user: 'user_admin', likedAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'rep_3',
      title: 'Q1 Market Analysis',
      description: 'Competitor pricing and market share analysis.',
      type: 'summary_report',
      author: { id: 'user_manager', name: 'Manager User', role: 'manager' },
      attachments: [],
      tags: ['market', 'analysis'],
      status: 'published',
      visibility: 'team',
      comments: [],
      likes: [],
      createdAt: new Date(Date.now() - 345600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: 'rep_4',
      title: 'Customer Feedback - March',
      description: 'Aggregated feedback from field visits.',
      type: 'client_feedback',
      author: { id: 'user_rep1', name: 'Sales Rep', role: 'sales' },
      attachments: [],
      tags: ['feedback', 'client'],
      status: 'published',
      visibility: 'team',
      comments: [],
      likes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  if (method === 'GET') {
    return res.status(200).json(mockReports);
  }

  if (method === 'POST') {
    return res.status(201).json({ ...req.body, _id: `rep_${Date.now()}`, author: { id: 'user_rep1', name: 'Sales Rep' }, createdAt: new Date().toISOString() });
  }

  return res.status(200).json([]);
}


export default withAuth(handler);
