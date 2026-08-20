import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// POST /api/columns/:columnId/tasks - Yeni Görev Ekle
router.post('/columns/:columnId/tasks', async (req: AuthRequest, res) => {
  try {
    const { columnId } = req.params as { columnId: string };
    const { title, description, assigneeId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
    }

    const column = await prisma.column.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      return res.status(404).json({ error: 'Kolon bulunamadı.' });
    }

    const taskCount = await prisma.task.count({
      where: { columnId },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        order: taskCount,
        columnId,
        assigneeId: assigneeId ? assigneeId : null,
      },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).json({ error: 'Görev oluşturulurken sunucu hatası meydana geldi.' });
  }
});

// PUT /api/tasks/:id - Görev güncelle
router.put('/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { title, description, assigneeId } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : task.title,
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
  } catch (error) {
    console.error('Görev güncelleme hatası:', error);
    res.status(500).json({ error: 'Görev güncellenemedi.' });
  }
});

// PUT /api/tasks/:id/move - Görevi başka kolona veya sıraya taşı (Drag & Drop)
router.put('/tasks/:id/move', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { destinationColumnId, newOrder } = req.body;

    if (!destinationColumnId || newOrder === undefined) {
      return res.status(400).json({ error: 'Hedef kolon ve sıra numarası zorunludur.' });
    }

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const sourceColumnId = task.columnId;
    const isSameColumn = sourceColumnId === destinationColumnId;

    if (isSameColumn) {
      // 1. Durum: Aynı Kolon İçi Sıralama
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
      // 2. Durum: Farklı Kolonlar Arası Taşıma
      // A) Kaynak kolondaki kalan görevleri sıfırdan diz
      const sourceTasks = await prisma.task.findMany({
        where: { columnId: sourceColumnId, id: { not: id } },
        orderBy: { order: 'asc' },
      });

      // B) Hedef kolondaki görevleri al ve taşınan görevi tam hedef sıraya yerleştir
      const destTasks = await prisma.task.findMany({
        where: { columnId: destinationColumnId, id: { not: id } },
        orderBy: { order: 'asc' },
      });

      const insertIdx = Math.min(Math.max(0, Number(newOrder)), destTasks.length);
      destTasks.splice(insertIdx, 0, task);

      // C) Hem kaynak hem hedef kolonu tek bir Transaction ile güvenle güncelle
      await prisma.$transaction([
        // Görevi yeni kolona aktar
        prisma.task.update({
          where: { id },
          data: { columnId: destinationColumnId },
        }),
        // Kaynak kolonu yeniden sırala (0, 1, 2...)
        ...sourceTasks.map((t, idx) =>
          prisma.task.update({
            where: { id: t.id },
            data: { order: idx },
          })
        ),
        // Hedef kolonu yeniden sırala (0, 1, 2...)
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
        assignee: {
          select: { id: true, email: true },
        },
      },
    });

    res.json(resultTask);
  } catch (error) {
    console.error('Görev taşıma hatası:', error);
    res.status(500).json({ error: 'Görev taşınamadı.' });
  }
});

// DELETE /api/tasks/:id - Görev sil
router.delete('/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      return res.status(404).json({ error: 'Görev bulunamadı.' });
    }

    const columnId = task.columnId;

    await prisma.task.delete({
      where: { id },
    });

    // Silinen görevden sonra kolondaki sıraları düzelt
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