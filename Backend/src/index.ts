import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { initSocket } from './lib/socket';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import boardRoutes from './routes/boards';
import taskRoutes from './routes/tasks';
import { initStaleTaskJob } from './jobs/staleTasks';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io Başlatma
initSocket(server);

// Rotalar (Routes)
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

initStaleTaskJob();