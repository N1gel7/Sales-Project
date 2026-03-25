export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Mock user validation - no database required
    const mockUsers = {
      'admin@example.com': { 
        password: 'Admin#123', 
        role: 'admin', 
        name: 'Admin User', 
        code: 'ADM001' 
      },
      'manager@example.com': { 
        password: 'Manager#123', 
        role: 'manager', 
        name: 'Manager User', 
        code: 'MGR001' 
      },
      'rep1@example.com': { 
        password: 'Rep#123', 
        role: 'sales', 
        name: 'Sales Rep', 
        code: 'SAL001' 
      }
    };

    const user = mockUsers[email];
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate a simple token (no database session required)
    const token = Buffer.from(JSON.stringify({ 
      email, 
      role: user.role, 
      name: user.name, 
      code: user.code,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    })).toString('base64');

    return res.status(200).json({ 
      token, 
      user: { 
        id: `user_${Date.now()}`,
        name: user.name, 
        role: user.role, 
        code: user.code, 
        email: email 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
