import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import boardRoutes from './routes/boards';
import taskRoutes from './routes/tasks';
import { prisma } from './lib/prisma';
import { setIO } from './lib/socket';

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

// Socket örneğini yardımcı dosyaya kaydet
setIO(io);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/columns', taskRoutes);

// Socket.io JWT Middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId?: string; id?: string };
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return next(new Error('Authentication error: Invalid payload'));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    socket.data.user = user;
    next();
  } catch {
    return next(new Error('Authentication error: Invalid token'));
  }
});

const boardPresence = new Map<string, Map<string, { id: string; email: string }>>();

io.on('connection', (socket) => {
  const user = socket.data.user;

  socket.on('join:board', (boardId: string) => {
    socket.join(`board:${boardId}`);

    if (!boardPresence.has(boardId)) {
      boardPresence.set(boardId, new Map());
    }
    boardPresence.get(boardId)!.set(socket.id, user);

    const activeUsers = Array.from(boardPresence.get(boardId)!.values());
    io.to(`board:${boardId}`).emit('presence:update', activeUsers);
  });

  socket.on('leave:board', (boardId: string) => {
    socket.leave(`board:${boardId}`);

    if (boardPresence.has(boardId)) {
      boardPresence.get(boardId)!.delete(socket.id);
      if (boardPresence.get(boardId)!.size === 0) {
        boardPresence.delete(boardId);
      } else {
        const activeUsers = Array.from(boardPresence.get(boardId)!.values());
        io.to(`board:${boardId}`).emit('presence:update', activeUsers);
      }
    }
  });

  socket.on('disconnect', () => {
    boardPresence.forEach((usersMap, boardId) => {
      if (usersMap.has(socket.id)) {
        usersMap.delete(socket.id);
        if (usersMap.size === 0) {
          boardPresence.delete(boardId);
        } else {
          const activeUsers = Array.from(usersMap.values());
          io.to(`board:${boardId}`).emit('presence:update', activeUsers);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});