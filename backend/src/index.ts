import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getHealth, getMyProfile } from './controllers/health.js';
import { authenticateUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// ---------- Routes ----------

// Public
app.get('/health', getHealth);

// Protected
app.get('/api/users/me', authenticateUser, getMyProfile);

// ---------- Error Handler (must be last) ----------
app.use(errorHandler);

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`[Backend] Server running on http://localhost:${PORT}`);
  console.log(`[Backend] Health check: http://localhost:${PORT}/health`);
});

export default app;