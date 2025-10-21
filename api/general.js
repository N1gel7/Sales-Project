import { dbConnect } from './_lib/db.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  try {
    await dbConnect(process.env.MONGODB_URI);
    
    const { method, url } = req;
    
    // Parse the URL to determine the operation
    const path = url.split('?')[0];
    
    // Handle different operations based on URL path or query parameters
    if (path.includes('/notifications') || req.query.type === 'notifications') {
      return handleNotifications(req, res);
    } else if (path.includes('/chats') || req.query.type === 'chats') {
      return handleChats(req, res);
    } else if (req.query.type === 'chat-messages') {
      return handleChatMessages(req, res);
    } else if (path.includes('/reports') || req.query.type === 'reports') {
      return handleReports(req, res);
    } else if (path.includes('/seed') || req.query.type === 'seed') {
      return handleSeed(req, res);
    } else if (path.includes('/logout-all') || req.query.type === 'logout-all') {
      return handleLogoutAll(req, res);
    }
    
    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('General API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

async function handleNotifications(req, res) {
  if (req.method === 'GET') {
    const { unread } = req.query;
    // Return empty array for now - can be extended later
    res.json([]);
  } else if (req.method === 'PATCH') {
    // Mark notification as read
    res.json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleChats(req, res) {
  if (req.method === 'GET') {
    // Return empty array for now - can be extended later
    res.json([]);
  } else if (req.method === 'POST') {
    const { name, type, participants } = req.body || {};
    const chat = {
      _id: `chat_${Date.now()}`,
      name,
      type,
      participants,
      createdAt: new Date().toISOString()
    };
    res.status(201).json(chat);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleChatMessages(req, res) {
  const { chatId } = req.query;
  
  if (req.method === 'GET') {
    // Return empty array for now - can be extended later
    res.json([]);
  } else if (req.method === 'POST') {
    const { content, type } = req.body || {};
    const message = {
      _id: `msg_${Date.now()}`,
      chatId,
      content,
      type: type || 'text',
      createdAt: new Date().toISOString()
    };
    res.status(201).json(message);
  } else if (req.method === 'PUT') {
    // Mark chat as read
    res.json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleReports(req, res) {
  if (req.method === 'GET') {
    // Return empty array for now - can be extended later
    res.json([]);
  } else if (req.method === 'POST') {
    const reportData = req.body || {};
    const report = {
      _id: `report_${Date.now()}`,
      ...reportData,
      createdAt: new Date().toISOString()
    };
    res.status(201).json(report);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleSeed(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if users already exist
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return res.status(409).json({ error: 'Database already seeded' });
    }

    // Create demo users
    const demoUsers = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('Admin#123', 10),
        role: 'admin',
        code: 'ADM001'
      },
      {
        name: 'Manager User',
        email: 'manager@example.com',
        passwordHash: await bcrypt.hash('Manager#123', 10),
        role: 'manager',
        code: 'MGR001'
      },
      {
        name: 'Sales Rep',
        email: 'rep1@example.com',
        passwordHash: await bcrypt.hash('Rep#123', 10),
        role: 'sales',
        code: 'SAL001'
      }
    ];

    await User.insertMany(demoUsers);

    res.json({ 
      message: 'Database seeded successfully',
      usersCreated: demoUsers.length 
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database' });
  }
}

async function handleLogoutAll(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Find the session to get user ID
    const session = await Session.findOne({ 
      token, 
      expiresAt: { $gt: new Date() } 
    }).populate('userId');

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Delete all sessions for this user
    await Session.deleteMany({ userId: session.userId._id });

    res.json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Failed to logout all sessions' });
  }
}
