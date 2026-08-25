import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/projects - Kullanıcının sahibi olduğu VEYA kendisine görev atanmış projeleri listele
router.get('/', async (req: AuthRequest, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
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
      include: {
        boards: true,
      },
    });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: 'Projeler getirilirken sunucu hatası oluştu.' });
  }
});

// POST /api/projects - Yeni proje oluştur
router.post('/', async (req: AuthRequest, res) => {
  try {
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
  } catch (error) {
    res.status(500).json({ error: 'Proje oluşturulurken sunucu hatası oluştu.' });
  }
});

// GET /api/projects/:id - Tek proje ve bağlı panoları (Sahibi veya görevlisi erişebilir)
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.project.findFirst({
      where: {
        id,
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
      include: {
        boards: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya erişim yetkiniz yok.' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Proje detayları getirilirken sunucu hatası oluştu.' });
  }
});

// PUT /api/projects/:id - Proje güncelle (Yalnızca proje sahibi)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { name, description } = req.body;

    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya düzenleme yetkiniz yok.' });
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: { name, description },
    });

    res.json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: 'Proje güncellenirken sunucu hatası oluştu.' });
  }
});

// DELETE /api/projects/:id - Proje sil (Yalnızca proje sahibi)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;

    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.userId },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya silme yetkiniz yok.' });
    }

    await prisma.project.delete({ where: { id } });
    res.json({ message: 'Proje silindi.' });
  } catch (error) {
    res.status(500).json({ error: 'Proje silinirken sunucu hatası oluştu.' });
  }
});

export default router;