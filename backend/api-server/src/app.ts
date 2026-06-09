import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import router from "./routes";
import { logger } from "./lib/logger";
import { connectMongoDB, mongoose } from "./lib/mongodb";
import { seedAdminAccounts } from "./lib/seed";

const app: Express = express();

// Non-blocking MongoDB connection and seeding
connectMongoDB()
  .then(() => seedAdminAccounts())
  .catch((err) => {
    logger.warn({ err }, "MongoDB initialization skipped - running in memory mode");
  });

// Attach logger to request object
app.use((req, res, next) => {
  (req as any).log = logger.child({
    requestId: Math.random().toString(36).substring(7),
    path: req.path,
    method: req.method,
  });
  next();
});

// Custom formatted logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalJson = res.json;
  const originalSend = res.send;

  // Override res.json to capture response data
  res.json = function (data: any) {
    const duration = Date.now() - start;
    const time = new Date().toLocaleTimeString("en-US");
    const logData = typeof data === "string" ? data : JSON.stringify(data);
    console.log(`${time} [express] ${req.method} ${req.url?.split("?")[0]} ${res.statusCode} in ${duration}ms :: ${logData}`);
    return originalJson.call(this, data);
  };

  // Override res.send for other responses
  res.send = function (data: any) {
    const duration = Date.now() - start;
    const time = new Date().toLocaleTimeString("en-US");
    if (res.statusCode >= 300 && res.statusCode < 400) {
      // For 304, 301, etc - just log status
      console.log(`${time} [express] ${req.method} ${req.url?.split("?")[0]} ${res.statusCode} in ${duration}ms`);
    }
    return originalSend.call(this, data);
  };

  next();
});

// Security: Trust proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// CORS Configuration - Explicitly list allowed origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:8080",
  "https://ewuradatahub.vercel.app",
  "https://ewuradatahub.com",
  "https://www.ewuradatahub.com",
  "https://ewura-hub-api.onrender.com",
];

// Add any additional origins from environment variable
if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN.split(",").map(o => o.trim());
  allowedOrigins.push(...envOrigins);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes(origin);
    
    if (isAllowed) {
      callback(null, true);
    } else {
      // Don't throw error, just reject silently for preflight
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Requested-With", "Idempotency-Key"],
  exposedHeaders: ["Content-Length", "X-Total-Count", "X-Page-Count"],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 200,
}));

// Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
});

// Request size limits to prevent DoS
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const sessionSecret = process.env.SESSION_SECRET || "allendatahub-super-secret-jwt-key-2024-for-ghana";

if (process.env.NODE_ENV === "production" && sessionSecret === "allendatahub-super-secret-jwt-key-2024-for-ghana") {
  logger.warn("⚠️  WARNING: Using default SESSION_SECRET in production! Please set SESSION_SECRET environment variable.");
}

// Session store - uses MongoDB if URI is configured
let sessionStore: any;
if (process.env.MONGODB_URI) {
  sessionStore = new MongoStore({
    mongoUrl: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB || "allen-datahub",
    collection: "sessions",
    touchAfter: 24 * 3600, // Lazy session update (touch every 24 hours)
    connectionOptions: {
      maxPoolSize: 10,
      minPoolSize: 2,
    },
  });
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
  store: sessionStore,
  cookie: {
    secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    domain: process.env.NODE_ENV === "production" ? undefined : "localhost",
    path: "/",
  },
}));

// Root route - API info
app.get("/", (_req, res) => {
  res.json({
    name: "Kheliss data Hub API",
    status: "running",
    version: "1.0.0",
    environment: process.env.NODE_ENV,
    endpoints: "/api",
  });
});

// Main API routes
app.use("/api", router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler - must be last
app.use((err: any, req: Express.Request, res: Express.Response, _next: Function) => {
  logger.error({ err, path: req.path, method: req.method }, "Request error");
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  
  // CORS headers will be added by the cors middleware above this point
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

export default app;
