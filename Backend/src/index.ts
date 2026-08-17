import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import boardRoutes from './routes/boards';
import taskRoutes from './routes/tasks';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API Rotaları
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api', taskRoutes); // /columns/:id/tasks ve /tasks/:id rotaları için

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Sunucu çalışıyor!' });
});

app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde yayında!`);
});