import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response) => {
  const userId = String(req.userId || '');

  try {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            boards: {
              some: {
                columns: {
                  some: {
                    tasks: {
                      some: {
                        assigneeId: userId,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        _count: {
          select: { boards: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(projects);
  } catch (error) {
    return res.status(500).json({ error: 'Projeler getirilemedi.' });
  }
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body;
  const userId = String(req.userId || '');

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Proje adı zorunludur.' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        ownerId: userId,
      },
    });
    return res.status(201).json(project);
  } catch (error) {
    return res.status(500).json({ error: 'Proje oluşturulamadı.' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const projectId = String(req.params.id);
  const userId = String(req.userId || '');

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          {
            boards: {
              some: {
                columns: {
                  some: {
                    tasks: {
                      some: {
                        assigneeId: userId,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        boards: {
          include: {
            _count: {
              select: { columns: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Proje bulunamadı veya erişim yetkiniz yok.' });
    }

    return res.json(project);
  } catch (error) {
    return res.status(500).json({ error: 'Proje detayları getirilemedi.' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const projectId = String(req.params.id);
  const { name, description } = req.body;
  const userId = String(req.userId || '');

  try {
    const existingProject = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!existingProject) {
      return res.status(403).json({ error: 'Projeyi düzenleme yetkiniz yok.' });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        description: description !== undefined ? String(description).trim() : undefined,
      },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Proje güncellenemedi.' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const projectId = String(req.params.id);
  const userId = String(req.userId || '');

  try {
    const existingProject = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!existingProject) {
      return res.status(403).json({ error: 'Projeyi silme yetkiniz yok.' });
    }

    await prisma.project.delete({ where: { id: projectId } });
    return res.json({ message: 'Proje silindi.' });
  } catch (error) {
    return res.status(500).json({ error: 'Proje silinemedi.' });
  }
});

// POST /api/projects/:id/boards -> Projeye Pano Ekleme
router.post('/:id/boards', async (req: AuthRequest, res: Response) => {
  const projectId = String(req.params.id);
  const { name } = req.body;
  const userId = String(req.userId || '');

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Pano adı zorunludur.' });
  }

  try {
    // Yalnızca Proje Sahibi pano ekleyebilir
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return res.status(403).json({ error: 'Pano oluşturma yetkiniz yok. Yalnızca proje sahibi pano ekleyebilir.' });
    }

    // Pano ve varsayılan 3 kolon (To Do, In Progress, Done) oluşturulur
    const result = await prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          name: String(name).trim(),
          projectId,
        },
      });

      await tx.column.createMany({
        data: [
          { name: 'To Do', order: 0, boardId: board.id },
          { name: 'In Progress', order: 1, boardId: board.id },
          { name: 'Done', order: 2, boardId: board.id },
        ],
      });

      return board;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Pano oluşturma hatası:', error);
    return res.status(500).json({ error: 'Pano oluşturulamadı.' });
  }
});

export default router;