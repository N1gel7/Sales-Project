export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json([
      { 
        _id: 'up_1', 
        filename: 'Mock Report.pdf', 
        type: 'application/pdf',
        note: 'First quarter sales report',
        user: { code: 'ADM001' },
        createdAt: new Date(Date.now() - 86400000).toISOString() 
      },
      { 
        _id: 'up_2', 
        filename: 'Store Visit.jpg', 
        type: 'image/jpeg',
        note: 'New store layout in Accra',
        user: { code: 'SAL001' },
        fileUrl: 'https://images.unsplash.com/photo-1534452203293-497d1ad262c2?w=400&h=400&fit=crop',
        coords: { lat: 5.6037, lng: -0.1870 },
        createdAt: new Date().toISOString() 
      },
      { 
        _id: 'up_3', 
        filename: 'voice_note_01.mp3', 
        type: 'audio/mpeg',
        note: 'Client feedback on pricing',
        user: { code: 'SAL001' },
        transcription: 'The client mentioned that the current pricing for Smartphone X is a bit high compared to competitors.',
        translation: 'Le client a mentionné que le prix actuel du Smartphone X est un peu élevé par rapport aux concurrents.',
        coords: { lat: 5.6342, lng: -0.2104 },
        createdAt: new Date().toISOString() 
      }
    ]);
  }

  if (req.method === 'POST') {
    // Mock successful upload
    return res.status(201).json({ 
      _id: `up_${Date.now()}`, 
      message: 'File uploaded successfully (mock)',
      createdAt: new Date().toISOString()
    });
  }

  return res.status(405).end();
}
