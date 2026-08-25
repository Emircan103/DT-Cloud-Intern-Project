import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/projects/:projectId/boards - Projenin panoları
router.get('/projects/:projectId/boards', async (req: AuthRequest, res) => {
  try {
    const projectId = req.params.projectId as string;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: req.userId },
          {
            boards: {
              some: {
                columns: {
                  some: {
                    tasks: {
                      some: { assigneeId: req.userId },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya yetkiniz yok.' });
    }

    const boards = await prisma.board.findMany({
      where: { projectId },
      include: {
        columns: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                assignee: { select: { id: true, email: true } },
              },
            },
          },
        },
      },
    });

    res.json(boards);
  } catch (error) {
    res.status(500).json({ error: 'Panolar listelenirken hata oluştu.' });
  }
});

// POST /api/boards - Yeni pano oluştur (Varsayılan To Do, In Progress, Done kolonlarıyla)
router.post('/boards', async (req: AuthRequest, res) => {
  try {
    const { name, projectId } = req.body;
    if (!name || !projectId) {
      return res.status(400).json({ error: 'Pano adı ve proje ID zorunludur.' });
    }

    const project = await prisma.project.findFirst({
      where: { id: String(projectId), ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya yetkiniz yok.' });
    }

    const board = await prisma.board.create({
      data: {
        name,
        projectId: String(projectId),
        columns: {
          create: [
            { name: 'To Do', order: 0 },
            { name: 'In Progress', order: 1 },
            { name: 'Done', order: 2 },
          ],
        },
      },
      include: {
        columns: true,
      },
    });

    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ error: 'Pano oluşturulurken hata oluştu.' });
  }
});

// GET /api/boards/:id/columns - Panoya ait kolonları ve filtrelenmiş görevleri listele
router.get('/boards/:id/columns', async (req: AuthRequest, res) => {
  try {
    const boardId = req.params.id as string;
    const { search, assigneeId } = req.query;

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

    // Arama ve Filtreleme Şartları
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
            assignee: { select: { id: true, email: true } },
          },
        },
      },
    });

    res.json(columns);
  } catch (error) {
    res.status(500).json({ error: 'Kolonlar listelenirken hata oluştu.' });
  }
});

// POST /api/columns/:columnId/tasks - Kolona yeni görev ekle
router.post('/columns/:columnId/tasks', async (req: AuthRequest, res) => {
  try {
    const columnId = req.params.columnId as string;
    const { title, description, assigneeId } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
    }

    // Kolonun ve projenin erişim kontrolü (Doğrudan veritabanı sorgusu ile güvenli kontrol)
    const column = await prisma.column.findFirst({
      where: {
        id: columnId,
        board: {
          project: {
            OR: [
              { ownerId: req.userId },
              {
                boards: {
                  some: {
                    columns: {
                      some: {
                        tasks: {
                          some: { assigneeId: req.userId },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    });

    if (!column) {
      return res.status(403).json({ error: 'Kolon bulunamadı veya bu panoya görev ekleme yetkiniz yok.' });
    }

    const taskCount = await prisma.task.count({
      where: { columnId },
    });

    const newTask = await prisma.task.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : '',
        order: taskCount,
        columnId,
        assigneeId: assigneeId && String(assigneeId).trim() !== '' ? String(assigneeId) : null,
      },
      include: {
        assignee: { select: { id: true, email: true } },
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Görev ekleme hatası:', error);
    res.status(500).json({ error: 'Görev eklenirken sunucu hatası oluştu.' });
  }
});

// PUT /api/boards/:id - Pano güncelle
router.put('/boards/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name } = req.body;

    const board = await prisma.board.findFirst({
      where: { id, project: { ownerId: req.userId } },
    });

    if (!board) return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });

    const updated = await prisma.board.update({
      where: { id },
      data: { name },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Pano güncellenemedi.' });
  }
});

// DELETE /api/boards/:id - Pano sil
router.delete('/boards/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const board = await prisma.board.findFirst({
      where: { id, project: { ownerId: req.userId } },
    });

    if (!board) return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });

    await prisma.board.delete({ where: { id } });
    res.json({ message: 'Pano silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Pano silinemedi.' });
  }
});

export default router;