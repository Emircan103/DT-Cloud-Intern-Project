import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// POST /api/columns/:columnId/tasks - Belirli bir kolona görev ekle
router.post('/columns/:columnId/tasks', async (req: AuthRequest, res) => {
  const { columnId } = req.params as { columnId: string };
  const { title, description, assigneeId } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
  }

  // Zincirleme yetki kontrolü: Column -> Board -> Project -> User
  const column = await prisma.column.findFirst({
    where: { id: columnId },
    include: {
      board: {
        include: { project: true },
      },
    },
  });

  if (!column || column.board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Kolon bulunamadı veya yetkiniz yok.' });
  }

  // Kolondaki mevcut en yüksek order değerini bul
  const lastTask = await prisma.task.findFirst({
    where: { columnId },
    orderBy: { order: 'desc' },
  });

  const nextOrder = lastTask ? lastTask.order + 1 : 0;

  const task = await prisma.task.create({
    data: {
      title,
      description,
      assigneeId: assigneeId || null,
      order: nextOrder,
      columnId,
    },
    include: {
      assignee: {
        select: { id: true, email: true },
      },
    },
  });

  res.status(201).json(task);
});

// PUT /api/tasks/:id - Görev güncelle (Başlık, Açıklama, Atanan Kişi)
router.put('/tasks/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { title, description, assigneeId } = req.body;

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: {
        include: {
          board: {
            include: { project: true },
          },
        },
      },
    },
  });

  if (!task || task.column.board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });
  }

  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      title: title ?? task.title,
      description: description !== undefined ? description : task.description,
      assigneeId: assigneeId !== undefined ? assigneeId : task.assigneeId,
    },
    include: {
      assignee: {
        select: { id: true, email: true },
      },
    },
  });

  res.json(updatedTask);
});

// PUT /api/tasks/:id/move - Görevi başka kolona veya sıraya taşı (Drag & Drop için)
router.put('/tasks/:id/move', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { destinationColumnId, newOrder } = req.body;

  if (destinationColumnId === undefined || newOrder === undefined) {
    return res.status(400).json({ error: 'Hedef kolon ID ve yeni sıra numarası zorunludur.' });
  }

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: {
        include: {
          board: {
            include: { project: true },
          },
        },
      },
    },
  });

  if (!task || task.column.board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });
  }

  const destinationColumn = await prisma.column.findFirst({
    where: { id: destinationColumnId },
    include: {
      board: {
        include: { project: true },
      },
    },
  });

  if (!destinationColumn || destinationColumn.board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Hedef kolon bulunamadı veya yetkiniz yok.' });
  }

  // Görevi yeni kolon ve sıra ile güncelle
  const movedTask = await prisma.task.update({
    where: { id },
    data: {
      columnId: destinationColumnId,
      order: newOrder,
    },
    include: {
      assignee: {
        select: { id: true, email: true },
      },
    },
  });

  res.json(movedTask);
});

// DELETE /api/tasks/:id - Görev sil
router.delete('/tasks/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };

  const task = await prisma.task.findFirst({
    where: { id },
    include: {
      column: {
        include: {
          board: {
            include: { project: true },
          },
        },
      },
    },
  });

  if (!task || task.column.board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Görev bulunamadı veya yetkiniz yok.' });
  }

  await prisma.task.delete({ where: { id } });
  res.json({ message: 'Görev silindi.' });
});

export default router;