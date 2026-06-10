import mongoose from "mongoose";
import { logger } from "./logger";

let isConnected = false;

export async function connectMongoDB(): Promise<void> {
  if (isConnected) return;

  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    logger.warn("DATABASE_URL/MONGODB_URI not set - running without MongoDB. Set one of these secrets to enable database persistence.");
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    logger.info("Connected to MongoDB");
  } catch (err) {
    logger.error({ err }, "Failed to connect to MongoDB");
  }
}

export { mongoose };
