import { dbConnect } from './_lib/db.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  await dbConnect(process.env.MONGODB_URI);
  
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
