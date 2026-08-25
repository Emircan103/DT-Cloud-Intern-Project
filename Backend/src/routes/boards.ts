import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/boards/:id/columns - Panoya ait kolonları ve filtrelenmiş görevleri listele
router.get('/:id/columns', async (req: AuthRequest, res: Response) => {
  try {
    const boardId = String(req.params.id);
    const rawSearch = req.query.search;
    const rawAssignee = req.query.assigneeId;

    const search = typeof rawSearch === 'string' && rawSearch.trim() !== '' 
      ? rawSearch.trim() 
      : undefined;

    const assigneeId = typeof rawAssignee === 'string' && rawAssignee.trim() !== '' 
      ? rawAssignee.trim() 
      : undefined;

    const currentUserId = String(req.userId || '');

    // Kullanıcı proje sahibi VEYA panodaki herhangi bir göreve atanmış kişi olmalıdır
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [
          { project: { ownerId: currentUserId } },
          { columns: { some: { tasks: { some: { assigneeId: currentUserId } } } } },
        ],
      },
    });

    if (!board) {
      return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
    }

    const taskWhere: Record<string, any> = {};

    if (search) {
      taskWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (assigneeId) {
      taskWhere.assigneeId = assigneeId;
    }

    const columns = await (prisma.column.findMany as any)({
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

    return res.json({ board, columns });
  } catch (error) {
    console.error('Kolonlar listelenirken hata:', error);
    return res.status(500).json({ error: 'Kolonlar listelenirken hata oluştu.' });
  }
});

// GET /api/boards/projects/:projectId - Projenin panoları
router.get('/projects/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const projectId = String(req.params.projectId);
    const currentUserId = String(req.userId || '');

    // Proje sahibi VEYA projeye ait görevlerde atanan kişi olan kullanıcılar panoları görebilir
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: currentUserId },
          { boards: { some: { columns: { some: { tasks: { some: { assigneeId: currentUserId } } } } } } },
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
        },
      },
    });

    return res.json(boards);
  } catch (error) {
    return res.status(500).json({ error: 'Panolar listelenirken hata oluştu.' });
  }
});

// POST /api/boards - Yeni pano oluştur (Sadece proje sahibi)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, projectId } = req.body;
    const currentUserId = String(req.userId || '');

    if (!name || !projectId) {
      return res.status(400).json({ error: 'Pano adı ve proje ID zorunludur.' });
    }

    const project = await prisma.project.findFirst({
      where: { id: String(projectId), ownerId: currentUserId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya yetkiniz yok.' });
    }

    const board = await prisma.board.create({
      data: {
        name: String(name).trim(),
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

    return res.status(201).json(board);
  } catch (error) {
    return res.status(500).json({ error: 'Pano oluşturulurken hata oluştu.' });
  }
});

// PATCH & PUT /api/boards/:id - Pano adını güncelle
const updateBoardHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { name } = req.body;
    const currentUserId = String(req.userId || '');

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Pano adı boş olamaz.' });
    }

    const existingBoard = await prisma.board.findFirst({
      where: {
        id,
        project: { ownerId: currentUserId },
      },
    });

    if (!existingBoard) {
      return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
    }

    const updatedBoard = await prisma.board.update({
      where: { id },
      data: {
        name: String(name).trim(),
      },
    });

    return res.json(updatedBoard);
  } catch (error) {
    console.error('Pano güncelleme hatası:', error);
    return res.status(500).json({ error: 'Pano güncellenirken hata oluştu.' });
  }
};

router.patch('/:id', updateBoardHandler);
router.put('/:id', updateBoardHandler);

// DELETE /api/boards/:id - Pano sil (Sadece proje sahibi)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const currentUserId = String(req.userId || '');

    const board = await prisma.board.findFirst({
      where: { id, project: { ownerId: currentUserId } },
    });

    if (!board) return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });

    await prisma.board.delete({ where: { id } });
    return res.json({ message: 'Pano silindi.' });
  } catch (error) {
    return res.status(500).json({ error: 'Pano silinemedi.' });
  }
});

export default router;