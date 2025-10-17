import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { dbConnect } from './_lib/db.js';
import Upload from '../models/Upload.js';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { type, note, taskId, coords, user } = req.body || {};
  if (!type || !user) return res.status(400).json({ error: 'type and user required' });

  try {
    await dbConnect(process.env.MONGODB_URI);
    
    // Generate presigned URL for direct upload to R2
    const key = `uploads/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: getContentType(type),
    });
    
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    
    // Save upload record with presigned URL
    const upload = await Upload.create({
      type,
      note,
      taskId,
      mediaUrl: publicUrl,
      coords,
      user: { id: user.id, email: user.email, code: user.code }
    });
    
    res.status(201).json({ 
      uploadId: upload._id,
      uploadUrl,
      publicUrl,
      key 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function getContentType(type) {
  const types = {
    image: 'image/jpeg',
    video: 'video/mp4',
    audio: 'audio/mpeg',
    note: 'text/plain'
  };
  return types[type] || 'application/octet-stream';
}
