import mongoose from "mongoose";

type CachedConn = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { __mongoose?: CachedConn };
const cached: CachedConn =
  globalForMongoose.__mongoose ?? (globalForMongoose.__mongoose = { conn: null, promise: null });

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.");
  }
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export async function disconnectMongo(): Promise<void> {
  if (cached.conn) {
    await cached.conn.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
