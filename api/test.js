export default async function handler(req, res) {
  try {
    return res.status(200).json({ 
      message: 'API is working',
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  } catch (error) {
    console.error('Test error:', error);
    return res.status(500).json({ error: 'Test failed', details: error.message });
  }
}
