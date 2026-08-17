import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/boards/:boardId/columns - Panoya ait kolonları ve görevleri getir (Filtreleme destekli)
router.get('/:boardId/columns', async (req: AuthRequest, res) => {
  const { boardId } = req.params as { boardId: string };
  const { search, assigneeId } = req.query as { search?: string; assigneeId?: string };

  // Zincirleme yetki kontrolü: Board -> Project -> User
  const board = await prisma.board.findFirst({
    where: { id: boardId },
    include: { project: true },
  });

  if (!board || board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
  }

  // Görev filtreleme koşulları
  const taskWhereClause: any = {};

  if (search) {
    taskWhereClause.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (assigneeId) {
    taskWhereClause.assigneeId = assigneeId;
  }

  const columns = await prisma.column.findMany({
    where: { boardId },
    orderBy: { order: 'asc' },
    include: {
      tasks: {
        where: taskWhereClause,
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

// POST /api/boards - Yeni pano oluştur (Otomatik 3 varsayılan kolon ile birlikte)
router.post('/', async (req: AuthRequest, res) => {
  const { name, projectId } = req.body;

  if (!name || !projectId) {
    return res.status(400).json({ error: 'Pano adı ve proje ID zorunludur.' });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: req.userId },
  });

  if (!project) {
    return res.status(404).json({ error: 'Proje bulunamadı.' });
  }

  // Pano ve varsayılan kolonları tek seferde oluşturuyoruz
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

// PUT /api/boards/:id - Pano adını güncelle
router.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Pano adı boş bırakılamaz.' });
  }

  const board = await prisma.board.findFirst({
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

// DELETE /api/boards/:id - Panoyu sil
router.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };

  const board = await prisma.board.findFirst({
    where: { id },
    include: { project: true },
  });

  if (!board || board.project.ownerId !== req.userId) {
    return res.status(404).json({ error: 'Pano bulunamadı veya yetkiniz yok.' });
  }

  await prisma.board.delete({ where: { id } });
  res.json({ message: 'Pano silindi.' });
});

export default router;