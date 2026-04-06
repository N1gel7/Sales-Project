import { withAuth } from './_lib/authMiddleware.js';

// In-memory typing state: Map<chatId, Map<userId, { name, expiresAt }>>
const typingState = new Map();

const TYPING_TTL_MS = 4000; // auto-expire after 4 seconds

function cleanExpired(chatId) {
  const chatMap = typingState.get(chatId);
  if (!chatMap) return;
  const now = Date.now();
  for (const [uid, entry] of chatMap) {
    if (now > entry.expiresAt) chatMap.delete(uid);
  }
  if (chatMap.size === 0) typingState.delete(chatId);
}

async function handler(req, res) {
  const { method } = req;

  try {
    if (method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { chatId, isTyping } = body || {};

      if (!chatId) return res.status(400).json({ error: 'chatId is required' });

      const userId = req.user?.id;
      const userName = req.user?.name || 'Unknown';

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      if (isTyping) {
        if (!typingState.has(chatId)) typingState.set(chatId, new Map());
        typingState.get(chatId).set(userId, {
          name: userName,
          expiresAt: Date.now() + TYPING_TTL_MS,
        });
      } else {
        const chatMap = typingState.get(chatId);
        if (chatMap) {
          chatMap.delete(userId);
          if (chatMap.size === 0) typingState.delete(chatId);
        }
      }

      return res.status(200).json({ ok: true });
    }

    if (method === 'GET') {
      const chatId = req.query?.chatId;
      if (!chatId) return res.status(400).json({ error: 'chatId query param is required' });

      const userId = req.user?.id;
      cleanExpired(chatId);

      const chatMap = typingState.get(chatId);
      const typers = [];
      if (chatMap) {
        for (const [uid, entry] of chatMap) {
          if (uid !== userId) {
            typers.push({ id: uid, name: entry.name });
          }
        }
      }

      return res.status(200).json(typers);
    }

    return res.status(405).end();
  } catch (error) {
    console.error('Typing endpoint error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export default withAuth(handler);
