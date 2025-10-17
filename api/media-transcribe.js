import OpenAI from 'openai';
import { dbConnect } from './_lib/db.js';
import Upload from '../models/Upload.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { uploadId, audioUrl } = req.body || {};
  if (!uploadId || !audioUrl) return res.status(400).json({ error: 'uploadId and audioUrl required' });

  try {
    await dbConnect(process.env.MONGODB_URI);
    
    // Transcribe audio using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioUrl,
      model: 'whisper-1',
    });
    
    // Update upload with transcription
    const upload = await Upload.findByIdAndUpdate(
      uploadId,
      { transcript: transcription.text },
      { new: true }
    );
    
    if (!upload) return res.status(404).json({ error: 'Upload not found' });
    
    res.status(200).json({ 
      transcript: transcription.text,
      upload 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
