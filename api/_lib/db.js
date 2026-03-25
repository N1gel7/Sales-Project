import mongoose from 'mongoose';

let cached = global.mongoose || { conn: null, promise: null };

export async function dbConnect(uri) {
  if (cached.conn) return cached.conn;
  
  if (!cached.promise) {
    if (!uri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    const opts = {
      bufferCommands: false,
    };
    
    cached.promise = mongoose.connect(uri, opts).then(m => m);
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  
  return cached.conn;
}


