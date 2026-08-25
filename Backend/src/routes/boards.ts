import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/boards/:id/columns - Panoya ait kolonları ve görevleri getir
router.get('/boards/:id/columns', async (req: AuthRequest, res) => {
  try {
    const boardId = req.params.id as string;
    const { search, assigneeId } = req.query;

    // Panoya erişim kontrolü (Proje sahibi VEYA panoda görevi olan kişi)
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { project: { ownerId: req.userId } },
          {
            columns: {
              some: {
                tasks: {
                  some: { assigneeId: req.userId },
                },
              },
            },
          },
        ],
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Pano bulunamadı veya erişim yetkiniz yok.' });
    }

    // Filtreleme koşulları
    const taskWhere: any = {};
    if (search) {
      taskWhere.OR = [
        { title: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (assigneeId) {
      taskWhere.assigneeId = String(assigneeId);
    }

    const columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
      include: {
        tasks: {
          where: taskWhere,
          orderBy: { order: 'asc' },
          include: {
            assignee: {
              select: { id: true, email: true },
            },
          },
        },
      },
    });

    res.json(columns);
  } catch (error) {
    console.error('Kolonlar getirilirken hata:', error);
    res.status(500).json({ error: 'Kolonlar getirilirken sunucu hatası oluştu.' });
  }
});

// POST /api/columns/:columnId/tasks - Kolona yeni görev ekle
router.post('/columns/:columnId/tasks', async (req: AuthRequest, res) => {
  try {
    const columnId = req.params.columnId as string;
    const { title, description, assigneeId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
    }

    // Kolonun ve projenin kontrolü
    const column = await prisma.column.findUnique({
      where: { id: columnId },
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
    });

    if (!column) {
      return res.status(404).json({ error: 'Kolon bulunamadı.' });
    }

    // Proje sahibi VEYA bu projede atanmış bir görevi olan kullanıcı ekleyebilir
    const isOwner = column.board.project.ownerId === req.userId;
    const hasAssignedTask = column.board.project.boards.some((b) =>
      b.columns.some((c) => c.tasks.some((t) => t.assigneeId === req.userId))
    );

    if (!isOwner && !hasAssignedTask) {
      return res.status(403).json({ error: 'Bu panoya görev ekleme yetkiniz yok.' });
    }

    // Kolondaki mevcut görev sayısına göre order belirle
    const taskCount = await prisma.task.count({
      where: { columnId },
    });

    const newTask = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : '',
        order: taskCount,
        columnId,
        assigneeId: assigneeId && assigneeId.trim() !== '' ? assigneeId : null,
      },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Görev ekleme hatası:', error);
    res.status(500).json({ error: 'Görev eklenirken sunucu hatası oluştu.' });
  }
});

export default router;