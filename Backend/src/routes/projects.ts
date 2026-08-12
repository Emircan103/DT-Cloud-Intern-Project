import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Bütün proje rotalarını JWT middleware ile koru
router.use(authenticateToken);

// GET /api/projects - Sadece giriş yapan kullanıcının projeleri
router.get('/', async (req: AuthRequest, res) => {
    const projects = await prisma.project.findMany({
        where: { ownerId: req.userId },
    });
    res.json(projects);
});

// POST /api/projects - Yeni proje oluştur
router.post('/', async (req: AuthRequest, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Proje adı zorunludur.' });

    const project = await prisma.project.create({
        data: {
            name,
            description,
            ownerId: req.userId!,
        },
    });
    res.status(201).json(project);
});

// GET /api/projects/:id - Tek bir projeyi getir
router.get('/:id', async (req: AuthRequest, res) => {
        const id = req.params.id as string;
        const project = await prisma.project.findFirst({
        where: { id, ownerId: req.userId },
    });

    if (!project) {
        return res.status(404).json({ error: 'Proje bulunamadı veya erişim yetkiniz yok.' });
    }

    res.json(project);
});

// PUT /api/projects/:id - Projeyi güncelle
router.put('/:id', async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const { name, description } = req.body;

    const project = await prisma.project.findFirst({
        where: { id, ownerId: req.userId },
    });

    if (!project) {
        return res.status(404).json({ error: 'Proje bulunamadı veya yetkiniz yok.' });
    }

    const updatedProject = await prisma.project.update({
        where: { id },
        data: { name, description },
    });

    res.json(updatedProject);
});

// DELETE /api/projects/:id - Projeyi sil
router.delete('/:id', async (req: AuthRequest, res) => {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
        where: { id, ownerId: req.userId },
    });

    if (!project) {
        return res.status(404).json({ error: 'Proje bulunamadı veya yetkiniz yok.' });
    }

    await prisma.project.delete({ where: { id } });
    res.json({ message: 'Proje başarıyla silindi.' });
});

export default router;