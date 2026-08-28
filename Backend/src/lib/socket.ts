import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

export let io: Server | null = null;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

interface SocketUser {
  id: string;
  email: string;
  socketId: string;
  boardId?: string;
}

// Benzersiz Soket ID takibi
const connectedSockets = new Map<string, SocketUser>();

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication error: Token missing'));

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email?: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true },
      });

      if (!user) return next(new Error('Authentication error: User not found'));

      socket.data.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as { id: string; email: string };
    
    // Her sekme kendi benzersiz socket.id'si ile kaydedilir
    connectedSockets.set(socket.id, {
      id: user.id,
      email: user.email,
      socketId: socket.id,
    });

    const broadcastPresence = (boardId: string) => {
      const usersInBoard: { id: string; email: string }[] = [];
      const seen = new Set<string>();

      for (const item of connectedSockets.values()) {
        if (item.boardId === boardId && !seen.has(item.id)) {
          seen.add(item.id);
          usersInBoard.push({ id: item.id, email: item.email });
        }
      }
      io?.to(`board:${boardId}`).emit('presence:update', usersInBoard);
    };

    socket.on('join:board', (boardId: string) => {
      socket.join(`board:${boardId}`);
      const entry = connectedSockets.get(socket.id);
      if (entry) {
        entry.boardId = boardId;
      }
      broadcastPresence(boardId);
    });

    socket.on('leave:board', (boardId: string) => {
      socket.leave(`board:${boardId}`);
      const entry = connectedSockets.get(socket.id);
      if (entry) {
        delete entry.boardId;
      }
      broadcastPresence(boardId);
    });

    socket.on('disconnect', () => {
      const entry = connectedSockets.get(socket.id);
      const boardId = entry?.boardId;
      connectedSockets.delete(socket.id);

      if (boardId) {
        broadcastPresence(boardId);
      }
    });
  });

  return io;
};

export const getIO = (): Server | null => io;