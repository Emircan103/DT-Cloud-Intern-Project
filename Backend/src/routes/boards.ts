import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/boards/:id/columns - Panoya ait kolonları ve görevleri getir
router.get('/:id/columns', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { search, assigneeId } = req.query;

  const board = await prisma.board.findUnique({
    where: { id },
    include: { project: true },
  });

  // Yetki Zinciri Kontrolü (Board -> Project -> User)
  if (!board || board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
  }

  const taskWhere: Record<string, unknown> = {};

  if (typeof search === 'string' && search.trim() !== '') {
    taskWhere.title = {
      contains: search.trim(),
      mode: 'insensitive',
    };
  }

  if (typeof assigneeId === 'string' && assigneeId.trim() !== '') {
    taskWhere.assigneeId = assigneeId.trim();
  }

  const columns = await prisma.column.findMany({
    where: { boardId: id },
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
});

// POST /api/boards/:id/columns - Panoya yeni kolon ekle
router.post('/:id/columns', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Kolon adı zorunludur.' });
  }

  const board = await prisma.board.findUnique({
    where: { id },
    include: { project: true },
  });

  // Yetki Zinciri Kontrolü
  if (!board || board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
  }

  const columnCount = await prisma.column.count({
    where: { boardId: id },
  });

  const column = await prisma.column.create({
    data: {
      name,
      order: columnCount,
      boardId: id,
    },
  });

  res.status(201).json(column);
});

// POST /api/columns/:columnId/tasks - Kolona yeni görev ekle
router.post('/columns/:columnId/tasks', async (req: AuthRequest, res) => {
  try {
    const { columnId } = req.params as { columnId: string };
    const { title, description, assigneeId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Görev başlığı zorunludur.' });
    }

    const column = await prisma.column.findUnique({
      where: { id: columnId },
      include: { board: { include: { project: true } } },
    });

    // Yetki Zinciri Kontrolü (Column -> Board -> Project -> User)
    if (!column || column.board.project.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Kolon bulunamadı veya yetkiniz yok.' });
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
        assigneeId: assigneeId && assigneeId.trim() !== '' ? assigneeId.trim() : null,
      },
      include: {
        assignee: {
          select: { id: true, email: true },
        },
      },
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Görev ekleme hatası:', error);
    res.status(500).json({ error: 'Görev eklenirken sunucu hatası oluştu.' });
  }
});

// POST /api/boards - Yeni pano oluştur
router.post('/', async (req: AuthRequest, res) => {
  const { name, projectId } = req.body;

  if (!name || !projectId) {
    return res.status(400).json({ error: 'Pano adı ve proje ID zorunludur.' });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  // Yetki Zinciri Kontrolü (Project -> User)
  if (!project || project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Proje bulunamadı veya yetkiniz yok.' });
  }

  const board = await prisma.board.create({
    data: {
      name,
      projectId,
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
});

// PUT /api/boards/:id - Pano adı güncelle
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Pano adı zorunludur.' });
  }

  const board = await prisma.board.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!board || board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
  }

  const updatedBoard = await prisma.board.update({
    where: { id },
    data: { name },
  });

  res.json(updatedBoard);
});

// DELETE /api/boards/:id - Pano sil
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };

  const board = await prisma.board.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!board || board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
  }

  await prisma.board.delete({
    where: { id },
  });

  res.json({ message: 'Pano başarıyla silindi.' });
});

export default router;