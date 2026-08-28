import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { io } from '../lib/socket';
import { notifyIfProjectAccessLost } from '../lib/access';

const router = Router();
router.use(authenticateToken);

// GET /api/boards/:id/columns
router.get('/:id/columns', async (req: AuthRequest, res: Response) => {
  const boardId = String(req.params.id);
  const userId = String(req.userId || '');
  const search = req.query.search
    ? String(req.query.search).toLowerCase()
    : '';
  const assigneeId = req.query.assigneeId
    ? String(req.query.assigneeId)
    : '';

  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    if (!board) {
      return res.status(404).json({
        error: 'Pano bulunamadı.',
      });
    }

    const isProjectOwner = board.project.ownerId === userId;

    // Erişim kontrolü:
    // Proje sahibi değilse, bu projede en az bir göreve atanmış olmalı.
    if (!isProjectOwner) {
      const hasAssignedTask = await prisma.task.count({
        where: {
          assigneeId: userId,
          column: {
            board: {
              projectId: board.project.id,
            },
          },
        },
      });

      if (hasAssignedTask === 0) {
        return res.status(403).json({
          error: 'Bu panoya erişim yetkiniz yok.',
        });
      }
    }

    let columns = await prisma.column.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
      include: {
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    // Görev filtreleme ve yetki filtrelemesi
    columns = columns.map((column) => {
      let tasks = column.tasks;

      // Arama filtresi
      if (search) {
        tasks = tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(search) ||
            (t.description &&
              t.description.toLowerCase().includes(search))
        );
      }

      // Assignee filtresi
      if (assigneeId) {
        tasks = tasks.filter(
          (t) => t.assigneeId === assigneeId
        );
      }

      return {
        ...column,
        tasks,
      };
    });

    return res.json({
      board,
      columns,
    });
  } catch (error) {
    console.error('Pano kolonları yüklenemedi:', error);

    return res.status(500).json({
      error: 'Pano verileri getirilemedi.',
    });
  }
});

// POST /api/boards
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, projectId } = req.body;
  const userId = String(req.userId || '');

  if (!name || !projectId) {
    return res.status(400).json({
      error: 'Pano adı ve Proje ID zorunludur.',
    });
  }

  try {
    const project = await prisma.project.findFirst({
      where: {
        id: String(projectId),
        ownerId: userId,
      },
    });

    if (!project) {
      return res.status(403).json({
        error: 'Yalnızca proje sahibi pano ekleyebilir.',
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const board = await tx.board.create({
        data: {
          name: String(name).trim(),
          projectId: String(projectId),
        },
      });

      await tx.column.createMany({
        data: [
          {
            name: 'To Do',
            order: 0,
            boardId: board.id,
          },
          {
            name: 'In Progress',
            order: 1,
            boardId: board.id,
          },
          {
            name: 'Done',
            order: 2,
            boardId: board.id,
          },
        ],
      });

      return board;
    });

    // Yeni pano oluşturulduğunda proje sahibine bildir.
    io?.to(`user:${userId}`).emit('project:updated', {
      projectId: project.id,
      board: result,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Pano oluşturulamadı:', error);

    return res.status(500).json({
      error: 'Pano oluşturulamadı.',
    });
  }
});

// PATCH /api/boards/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const boardId = String(req.params.id);
  const { name } = req.body;
  const userId = String(req.userId || '');

  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: true,
      },
    });

    if (!board) {
      return res.status(404).json({
        error: 'Pano bulunamadı.',
      });
    }

    if (board.project.ownerId !== userId) {
      return res.status(403).json({
        error: 'Pano adını yalnızca proje sahibi değiştirebilir.',
      });
    }

    const updated = await prisma.board.update({
      where: { id: boardId },
      data: {
        name: String(name).trim(),
      },
    });

    // 1. Panoyu şu anda açık olan kullanıcılara bildir
    io?.to(`board:${boardId}`).emit(
      'board:updated',
      updated
    );

    // 2. Proje detay/listesi açık olan proje sahibine bildir
    io?.to(`user:${board.project.ownerId}`).emit(
      'project:updated',
      {
        projectId: board.project.id,
        board: updated,
      }
    );

    // 3. Projede görevi olan kullanıcılara da bildir
    const affectedTasks = await prisma.task.findMany({
      where: {
        column: {
          board: {
            projectId: board.project.id,
          },
        },
      },
      select: {
        assigneeId: true,
      },
    });

    const affectedUserIds = Array.from(
      new Set(
        affectedTasks
          .map((task) => task.assigneeId)
          .filter(
            (id): id is string =>
              Boolean(id) &&
              id !== board.project.ownerId
          )
      )
    );

    for (const affectedUserId of affectedUserIds) {
      io?.to(`user:${affectedUserId}`).emit(
        'project:updated',
        {
          projectId: board.project.id,
          board: updated,
        }
      );
    }

    return res.json(updated);
  } catch (error) {
    console.error('Pano güncellenemedi:', error);

    return res.status(500).json({
      error: 'Pano güncellenemedi.',
    });
  }
});

// DELETE /api/boards/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const boardId = String(req.params.id);

  try {
    // Panoyu bulup hangi projeye ait olduğunu öğreniyoruz.
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        project: true,
      },
    });

    if (!board) {
      return res.status(404).json({
        error: 'Pano bulunamadı.',
      });
    }

    // Panodaki görevlerden etkilenecek kullanıcıları
    // silmeden önce tespit ediyoruz.
    const affectedTasks = await prisma.task.findMany({
      where: {
        column: {
          boardId,
        },
      },
      select: {
        assigneeId: true,
      },
    });

    const affectedAssigneeIds = Array.from(
      new Set(
        affectedTasks
          .map((t) => t.assigneeId)
          .filter(
            (id): id is string => Boolean(id)
          )
      )
    );

    await prisma.board.delete({
      where: { id: boardId },
    });

    // 1. Panoyu açık tutan kullanıcıları bilgilendir
    io?.to(`board:${boardId}`).emit(
      'board:deleted'
    );

    // 2. Proje sahibinin proje listesini güncelle
    io?.to(`user:${board.project.ownerId}`).emit(
      'project:updated',
      board.project
    );

    // 3. Panoda görevi olan kullanıcıları bilgilendir
    for (const assigneeId of affectedAssigneeIds) {
      io?.to(`user:${assigneeId}`).emit(
        'project:updated'
      );

      // Kullanıcının artık projeye erişimi kalmadıysa
      // anlık olarak erişimini sonlandır.
      await notifyIfProjectAccessLost(
        assigneeId,
        board.project.id
      );
    }

    return res.json({
      message: 'Pano başarıyla silindi.',
    });
  } catch (error) {
    console.error('Pano silinemedi:', error);

    return res.status(500).json({
      error: 'Pano silinemedi.',
    });
  }
});

export default router;