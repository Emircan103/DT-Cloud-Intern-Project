import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// POST /api/boards - Pano ekle
router.post('/', async (req: AuthRequest, res) => {
  const { name, projectId } = req.body;

  if (!name || !projectId) {
    return res.status(400).json({ error: 'Pano adı ve proje ID zorunludur.' });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: req.userId },
  });

  if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

  const board = await prisma.board.create({
    data: { name, projectId },
  });

  res.status(201).json(board);
});

// DELETE /api/boards/:id - Pano sil
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

export default router;