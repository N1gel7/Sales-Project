import mongoose from 'mongoose';

let cached = global.mongoose || { conn: null, promise: null };
global.mongoose = cached;

export async function dbConnect(uri) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    // Respect the DB specified in the URI; no hardcoded dbName here
    cached.promise = mongoose.connect(uri).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}


