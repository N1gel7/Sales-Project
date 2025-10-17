import { dbConnect } from './_lib/db.js';

export default async function handler(req, res) {
  try {
    await dbConnect(process.env.MONGODB_URI);
    return res.status(200).json({ ok: true, db: 'connected' });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}


