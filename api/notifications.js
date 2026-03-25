export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  
  // Return empty notifications for now to prevent 404
  return res.status(200).json([]);
}
