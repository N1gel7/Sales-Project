export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { type, email: rawEmail, password } = body || {};
    const email = rawEmail?.toLowerCase().trim();
    
    if (type === 'login' || type === 'signup') {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      // Mock users
      const mockUsers = {
        'admin@example.com': { password: 'Admin#123', role: 'admin', name: 'Admin User', code: 'ADM001' },
        'manager@example.com': { password: 'Manager#123', role: 'manager', name: 'Manager User', code: 'MGR001' },
        'rep1@example.com': { password: 'Rep#123', role: 'sales', name: 'Sales Rep', code: 'SAL001' }
      };

      const user = mockUsers[email];
      
      // For mock signup, we'll just allow any new account to be "sales"
      const finalUser = user || (type === 'signup' ? { role: 'sales', name: email.split('@')[0], code: 'NEW' } : null);

      if (!finalUser || (user && user.password !== password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Simple mock token (no JWT)
      const token = 'mock-session-active';

      return res.status(200).json({ 
        token, 
        user: { 
          id: `user_${Date.now()}`,
          name: finalUser.name, 
          role: finalUser.role, 
          code: finalUser.code, 
          email: email 
        } 
      });
    }
    
    return res.status(400).json({ error: 'Unsupported type' });
  } catch (error) {
    console.error('Fatal Auth Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
