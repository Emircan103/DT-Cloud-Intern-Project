import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/projects/:projectId/boards - Projeye ait panoları getir
router.get('/projects/:projectId/boards', async (req: AuthRequest, res) => {
    const { projectId } = req.params as { projectId: string };

    // Önce projenin kullanıcıya ait olup olmadığını kontrol et
    const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: req.userId },
    });

    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const boards = await prisma.board.findMany({ where: { projectId } });
    res.json(boards);
});

// POST /api/projects/:projectId/boards - Proje altında pano oluştur
router.post('/projects/:projectId/boards', async (req: AuthRequest, res) => {
    const { projectId } = req.params as { projectId: string };
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Pano adı zorunludur.' });

    const project = await prisma.project.findFirst({
        where: { id: projectId, ownerId: req.userId },
    });

    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });

    const board = await prisma.board.create({
        data: { name, projectId },
    });

    res.status(201).json(board);
});

// PUT /api/boards/:id - Pano adını güncelle
router.put('/boards/:id', async (req: AuthRequest, res) => {
    const { id } = req.params as { id: string };
    const { name } = req.body;

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
router.delete('/boards/:id', async (req: AuthRequest, res) => {
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