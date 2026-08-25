import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getIO } from '../lib/socket';

const router = Router();
router.use(authenticateToken);

// Sahiplik Doğrulama: Proje sahibi VEYA göreve atanmış kullanıcı
const verifyTaskOwnership = async (taskId: string, userId: string) => {
  return await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { column: { board: { project: { ownerId: userId } } } },
        { assigneeId: userId },
      ],
    },
    include: {
      column: {
        select: { boardId: true },
      },
    },
  });
};

// GET /api/tasks/:taskId/comments
router.get('/:taskId/comments', async (req: AuthRequest, res: Response) => {
  const taskId = String(req.params.taskId);
  const userId = String(req.userId || '');

  try {
    const task = await verifyTaskOwnership(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı veya erişim yetkiniz yok.' });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(comments);
  } catch (error) {
    return res.status(500).json({ error: 'Yorumlar getirilemedi.' });
  }
});

// POST /api/tasks/:taskId/comments
router.post('/:taskId/comments', async (req: AuthRequest, res: Response) => {
  const taskId = String(req.params.taskId);
  const { content } = req.body;
  const userId = String(req.userId || '');

  if (!content || !String(content).trim() || !userId) {
    return res.status(400).json({ error: 'Geçersiz yorum içeriği veya yetkisiz erişim.' });
  }

  try {
    const task = await verifyTaskOwnership(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });
    }

    const comment = await prisma.comment.create({
      data: {
        content: String(content).trim(),
        taskId,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, email: true } },
      },
    });

    const log = await prisma.activityLog.create({
      data: {
        action: 'COMMENT_ADDED',
        taskId,
        userId,
      },
      include: { user: { select: { id: true, email: true } } },
    });

    const io = getIO();
    if (io && task.column?.boardId) {
      io.to(`board:${task.column.boardId}`).emit('comment:created', { comment, taskId });
      io.to(`board:${task.column.boardId}`).emit('activity:created', { log, taskId });
    }

    return res.status(201).json(comment);
  } catch (error) {
    console.error('Yorum eklenemedi:', error);
    return res.status(500).json({ error: 'Yorum eklenemedi.' });
  }
});

// GET /api/tasks/:taskId/activity
router.get('/:taskId/activity', async (req: AuthRequest, res: Response) => {
  const taskId = String(req.params.taskId);
  const userId = String(req.userId || '');

  try {
    const task = await verifyTaskOwnership(taskId, userId);
    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });
    }

    const activities = await prisma.activityLog.findMany({
      where: { taskId },
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ error: 'Aktivite geçmişi getirilemedi.' });
  }
});

// Kolona Görev Ekleme Fonksiyonu
const createTaskInColumn = async (req: AuthRequest, res: Response) => {
  const columnId = String(req.params.columnId);
  const { title, description, assigneeId } = req.body;
  const userId = String(req.userId || '');

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Yetkisiz erişim, kullanıcı bulunamadı.' });
  }

  try {
    const column = await prisma.column.findFirst({
      where: {
        id: columnId,
        board: {
          project: {
            ownerId: userId,
          },
        },
      },
      include: {
        board: true,
      },
    });

    if (!column) {
      return res.status(403).json({ error: 'Kolon bulunamadı veya bu projeye görev ekleme yetkiniz yok.' });
    }

    const taskCount = await prisma.task.count({
      where: { columnId },
    });

    const task = await prisma.task.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : '',
        order: taskCount,
        columnId,
        assigneeId: assigneeId && String(assigneeId).trim() !== '' ? String(assigneeId) : null,
      },
      include: {
        assignee: { select: { id: true, email: true } },
        column: { select: { boardId: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        action: 'TASK_CREATED',
        taskId: task.id,
        userId,
      },
    });

    const io = getIO();
    if (io) {
      io.to(`board:${column.boardId}`).emit('task:created', task);
    }

    return res.status(201).json(task);
  } catch (error) {
    console.error('Görev ekleme hatası:', error);
    return res.status(500).json({ error: 'Görev eklenirken sunucu hatası oluştu.' });
  }
};

router.post('/:columnId/tasks', createTaskInColumn);
router.post('/columns/:columnId/tasks', createTaskInColumn);

// POST /api/tasks
router.post('/', async (req: AuthRequest, res: Response) => {
  const { title, description, columnId, assigneeId } = req.body;
  const userId = String(req.userId || '');

  if (!title || !columnId || !userId) {
    return res.status(400).json({ error: 'Başlık ve Kolon ID zorunludur.' });
  }

  try {
    const column = await prisma.column.findFirst({
      where: {
        id: String(columnId),
        board: { project: { ownerId: userId } },
      },
    });

    if (!column) return res.status(403).json({ error: 'Yetkisiz erişim veya kolon bulunamadı.' });

    const taskCount = await prisma.task.count({ where: { columnId: String(columnId) } });

    const task = await prisma.task.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : '',
        order: taskCount,
        columnId: String(columnId),
        assigneeId: assigneeId && String(assigneeId).trim() !== '' ? String(assigneeId) : null,
      },
      include: {
        assignee: { select: { id: true, email: true } },
        column: { select: { boardId: true } },
      },
    });

    await prisma.activityLog.create({
      data: { action: 'TASK_CREATED', taskId: task.id, userId },
    });

    const io = getIO();
    if (io) io.to(`board:${task.column.boardId}`).emit('task:created', task);

    return res.status(201).json(task);
  } catch (error) {
    return res.status(500).json({ error: 'Görev eklenemedi.' });
  }
});

// PUT & PATCH /api/tasks/:id
const updateTaskHandler = async (req: AuthRequest, res: Response) => {
  const taskId = String(req.params.id);
  const { title, description, assigneeId } = req.body;
  const userId = String(req.userId || '');

  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim.' });

  try {
    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        column: {
          include: {
            board: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const isProjectOwner = existingTask.column.board.project.ownerId === userId;
    const isAssignee = existingTask.assigneeId === userId;

    if (!isProjectOwner && !isAssignee) {
      return res.status(403).json({ error: 'Bu görevi düzenleme yetkiniz yok.' });
    }

    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId && !isProjectOwner) {
      return res.status(403).json({ error: 'Göreve atanan kişiyi yalnızca proje sahibi değiştirebilir.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: title !== undefined ? String(title).trim() : undefined,
        description: description !== undefined ? String(description).trim() : undefined,
        assigneeId: isProjectOwner && assigneeId !== undefined 
          ? (assigneeId && String(assigneeId).trim() !== '' ? String(assigneeId) : null) 
          : undefined,
      },
      include: {
        assignee: { select: { id: true, email: true } },
        column: { select: { boardId: true } },
      },
    });

    if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId && isProjectOwner) {
      await prisma.activityLog.create({
        data: { action: 'TASK_ASSIGNED', taskId, userId },
      });
    } else {
      await prisma.activityLog.create({
        data: { action: 'TASK_UPDATED', taskId, userId },
      });
    }

    const io = getIO();
    if (io) io.to(`board:${updatedTask.column.boardId}`).emit('task:updated', updatedTask);

    return res.json(updatedTask);
  } catch (error) {
    return res.status(500).json({ error: 'Görev güncellenemedi.' });
  }
};

router.put('/:id', updateTaskHandler);
router.patch('/:id', updateTaskHandler);

// PUT /api/tasks/:id/move
router.put('/:id/move', async (req: AuthRequest, res: Response) => {
  const taskId = String(req.params.id);
  const { targetColumnId, newOrder } = req.body;
  const userId = String(req.userId || '');

  if (!userId || !targetColumnId || newOrder === undefined) {
    return res.status(400).json({ error: 'Hedef kolon, yeni sıra (newOrder) ve kullanıcı zorunludur.' });
  }

  try {
    const existingTask = await verifyTaskOwnership(taskId, userId);
    if (!existingTask) return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });

    const sourceColumnId = existingTask.columnId;
    const targetColId = String(targetColumnId);
    const targetPosition = Number(newOrder);

    await prisma.$transaction(async (tx) => {
      if (sourceColumnId === targetColId) {
        const columnTasks = await tx.task.findMany({
          where: { columnId: sourceColumnId },
          orderBy: { order: 'asc' },
        });

        const reordered = columnTasks.filter((t) => t.id !== taskId);
        reordered.splice(targetPosition, 0, existingTask);

        for (let i = 0; i < reordered.length; i++) {
          await tx.task.update({
            where: { id: reordered[i].id },
            data: { order: i },
          });
        }
      } else {
        const sourceTasks = await tx.task.findMany({
          where: { 
            columnId: sourceColumnId, 
            id: { not: taskId } 
          },
          orderBy: { order: 'asc' },
        });

        for (let i = 0; i < sourceTasks.length; i++) {
          await tx.task.update({
            where: { id: sourceTasks[i].id },
            data: { order: i },
          });
        }

        const targetTasks = await tx.task.findMany({
          where: { columnId: targetColId },
          orderBy: { order: 'asc' },
        });
        targetTasks.splice(targetPosition, 0, existingTask);

        for (let i = 0; i < targetTasks.length; i++) {
          await tx.task.update({
            where: { id: targetTasks[i].id },
            data: {
              columnId: targetColId,
              order: i,
            },
          });
        }
      }
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, email: true } },
        column: { select: { boardId: true } },
      },
    });

    await prisma.activityLog.create({
      data: { action: 'TASK_MOVED', taskId, userId },
    });

    const io = getIO();
    if (io && updatedTask) {
      io.to(`board:${updatedTask.column.boardId}`).emit('task:updated', updatedTask);
    }

    return res.json(updatedTask);
  } catch (error) {
    console.error('Taşıma hatası:', error);
    return res.status(500).json({ error: 'Görev sıralaması güncellenemedi.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const taskId = String(req.params.id);
  const userId = String(req.userId || '');

  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim.' });

  try {
    const task = await verifyTaskOwnership(taskId, userId);
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });

    await prisma.activityLog.create({
      data: { action: 'TASK_DELETED', taskId, userId },
    });

    await prisma.task.delete({ where: { id: taskId } });

    const io = getIO();
    if (io) {
      io.to(`board:${task.column.boardId}`).emit('task:deleted', {
        taskId,
        columnId: task.columnId,
      });
    }

    return res.json({ message: 'Görev silindi.' });
  } catch (error) {
    return res.status(500).json({ error: 'Görev silinemedi.' });
  }
});

export default router;