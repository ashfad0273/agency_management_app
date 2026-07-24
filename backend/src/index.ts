import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { getHealth } from './controllers/health.js';
import { getMyProfile } from './controllers/users.js';
import { authenticateUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ---------- Middleware ----------
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin.split(','), credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

// ---------- Routes ----------

// Public
app.get('/health', getHealth);

// Protected
app.get('/api/users/me', authenticateUser, getMyProfile);

// ---------- Error Handler (must be last) ----------
app.use(errorHandler);

// ---------- Start Server ----------
const server = app.listen(PORT, () => {
  console.log(`[Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Backend] Health check: http://localhost:${PORT}/health`);
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Backend] Port ${PORT} is already in use.`);
  } else {
    console.error('[Backend] Failed to start server:', err.message);
  }
  process.exit(1);
});

// ---------- Graceful Shutdown ----------
const shutdown = (signal: string) => {
  console.log(`[Backend] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[Backend] Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Backend] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;