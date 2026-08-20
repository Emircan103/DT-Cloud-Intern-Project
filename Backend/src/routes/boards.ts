import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/boards/:id/columns - Panoya ait kolonları ve görevleri getir
router.get('/:id/columns', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { search, assigneeId } = req.query;

  const board = await prisma.board.findFirst({
    where: { id },
    include: { project: true },
  });

  if (!board) {
    return res.status(404).json({ error: 'Pano bulunamadı.' });
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

  const board = await prisma.board.findFirst({
    where: { id },
  });

  if (!board) {
    return res.status(404).json({ error: 'Pano bulunamadı.' });
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

// POST /api/boards - Yeni pano oluştur
router.post('/', async (req: AuthRequest, res) => {
  const { name, projectId } = req.body;

  if (!name || !projectId) {
    return res.status(400).json({ error: 'Pano adı ve proje ID zorunludur.' });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId },
  });

  if (!project) {
    return res.status(404).json({ error: 'Proje bulunamadı.' });
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

  const updatedBoard = await prisma.board.update({
    where: { id },
    data: { name },
  });

  res.json(updatedBoard);
});

// DELETE /api/boards/:id - Pano sil
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };

  await prisma.board.delete({
    where: { id },
  });

  res.json({ message: 'Pano başarıyla silindi.' });
});

export default router;