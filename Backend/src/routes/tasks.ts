import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// PUT /api/tasks/:id - Görev güncelle (Başlık, Açıklama, Atanan Kişi)
router.put('/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { title, description, assigneeId } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        column: {
          include: {
            board: {
              include: {
                project: {
                  include: {
                    boards: {
                      include: {
                        columns: {
                          include: { tasks: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const isOwner = task.column.board.project.ownerId === req.userId;
    const isAssignee = task.assigneeId === req.userId;
    const isMember = task.column.board.project.boards.some((b) =>
      b.columns.some((c) => c.tasks.some((t) => t.assigneeId === req.userId))
    );

    if (!isOwner && !isAssignee && !isMember) {
      return res.status(403).json({ error: 'Görevi güncelleme yetkiniz yok.' });
    }

    // Yalnızca Proje Sahibi görev atamasını (assignee) değiştirebilir
    if (!isOwner && assigneeId !== undefined && assigneeId !== task.assigneeId) {
      return res.status(403).json({ error: 'Görev atama yetkisi yalnızca proje yöneticisine aittir.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : task.title,
        description: description !== undefined ? description.trim() : task.description,
        assigneeId: isOwner && assigneeId !== undefined ? (assigneeId === '' ? null : assigneeId) : task.assigneeId,
      },
      include: {
        assignee: { select: { id: true, email: true } },
      },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    res.status(500).json({ error: 'Görev güncellenemedi.' });
  }
});

// PUT /api/tasks/:id/move - Sürükle Bırak (Kolon veya Sıra Değişimi)
router.put('/tasks/:id/move', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { destinationColumnId, newOrder } = req.body;

    if (!destinationColumnId || newOrder === undefined) {
      return res.status(400).json({ error: 'Hedef kolon ve sıra numarası zorunludur.' });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        column: {
          include: {
            board: {
              include: {
                project: {
                  include: {
                    boards: {
                      include: {
                        columns: {
                          include: { tasks: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const isOwner = task.column.board.project.ownerId === req.userId;
    const isAssignee = task.assigneeId === req.userId;
    const isMember = task.column.board.project.boards.some((b) =>
      b.columns.some((c) => c.tasks.some((t) => t.assigneeId === req.userId))
    );

    if (!isOwner && !isAssignee && !isMember) {
      return res.status(403).json({ error: 'Görevi taşıma yetkiniz yok.' });
    }

    const destColumn = await prisma.column.findUnique({
      where: { id: destinationColumnId },
      include: { board: true },
    });

    if (!destColumn || destColumn.boardId !== task.column.boardId) {
      return res.status(400).json({ error: 'Hedef kolon aynı panoda olmalıdır.' });
    }

    const sourceColumnId = task.columnId;
    const isSameColumn = sourceColumnId === destinationColumnId;

    if (isSameColumn) {
      const colTasks = await prisma.task.findMany({
        where: { columnId: sourceColumnId },
        orderBy: { order: 'asc' },
      });

      const currentIdx = colTasks.findIndex((t) => t.id === id);
      if (currentIdx !== -1) {
        const [moved] = colTasks.splice(currentIdx, 1);
        const insertIdx = Math.min(Math.max(0, Number(newOrder)), colTasks.length);
        colTasks.splice(insertIdx, 0, moved);

        await prisma.$transaction(
          colTasks.map((t, idx) =>
            prisma.task.update({
              where: { id: t.id },
              data: { order: idx },
            })
          )
        );
      }
    } else {
      const sourceTasks = await prisma.task.findMany({
        where: { columnId: sourceColumnId, id: { not: id } },
        orderBy: { order: 'asc' },
      });

      const destTasks = await prisma.task.findMany({
        where: { columnId: destinationColumnId, id: { not: id } },
        orderBy: { order: 'asc' },
      });

      const insertIdx = Math.min(Math.max(0, Number(newOrder)), destTasks.length);
      destTasks.splice(insertIdx, 0, task);

      await prisma.$transaction([
        prisma.task.update({
          where: { id },
          data: { columnId: destinationColumnId },
        }),
        ...sourceTasks.map((t, idx) =>
          prisma.task.update({
            where: { id: t.id },
            data: { order: idx },
          })
        ),
        ...destTasks.map((t, idx) =>
          prisma.task.update({
            where: { id: t.id },
            data: { order: idx },
          })
        ),
      ]);
    }

    const resultTask = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: { select: { id: true, email: true } },
      },
    });

    res.json(resultTask);
  } catch (error) {
    console.error('Görev taşıma hatası:', error);
    res.status(500).json({ error: 'Görev taşınamadı.' });
  }
});

// DELETE /api/tasks/:id - Görev sil (Yalnızca Proje Sahibi)
router.delete('/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const task = await prisma.task.findUnique({
      where: { id },
      include: { column: { include: { board: { include: { project: true } } } } },
    });

    if (!task || task.column.board.project.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Görev bulunamadı veya silme yetkiniz yok.' });
    }

    const columnId = task.columnId;

    await prisma.task.delete({ where: { id } });

    const remainingTasks = await prisma.task.findMany({
      where: { columnId },
      orderBy: { order: 'asc' },
    });

    await prisma.$transaction(
      remainingTasks.map((t, idx) =>
        prisma.task.update({
          where: { id: t.id },
          data: { order: idx },
        })
      )
    );

    res.json({ message: 'Görev başarıyla silindi.' });
  } catch (error) {
    console.error('Görev silme hatası:', error);
    res.status(500).json({ error: 'Görev silinemedi.' });
  }
});

export default router;