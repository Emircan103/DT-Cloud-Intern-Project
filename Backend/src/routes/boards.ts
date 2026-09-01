import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { io } from '../lib/socket';
import { notifyIfProjectAccessLost } from '../lib/access';
import { invalidateBoardCache } from '../middleware/cache';
import redis from '../lib/redis';

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

    // --- REDIS CACHE KONTROLÜ (Sadece genel listelemede, filtresizken önbelleklenir) ---
    const isFiltered = Boolean(search || assigneeId);
    const cacheKey = `board:${boardId}`;

    if (!isFiltered) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`⚡ [CACHE HIT] Board ${boardId} Redis'ten getirildi.`);
          return res.json(JSON.parse(cached));
        }
        console.log(`🐢 [CACHE MISS] Board ${boardId} Prisma'dan getiriliyor.`);
      } catch (cacheErr) {
        console.error('Redis okuma hatası:', cacheErr);
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

    // Görev filtreleme
    columns = columns.map((column) => {
      let tasks = column.tasks;

      if (search) {
        tasks = tasks.filter(
          (t) =>
            t.title.toLowerCase().includes(search) ||
            (t.description &&
              t.description.toLowerCase().includes(search))
        );
      }

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

    const responsePayload = {
      board,
      columns,
    };

    // Filtresiz genel istek ise Redis'e yaz (1 saat TTL)
    if (!isFiltered) {
      try {
        await redis.setex(cacheKey, 3600, JSON.stringify(responsePayload));
      } catch (cacheErr) {
        console.error('Redis yazma hatası:', cacheErr);
      }
    }

    return res.json(responsePayload);
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

    // Pano güncellendiği için cache temizlenir
    await invalidateBoardCache(boardId);

    io?.to(`board:${boardId}`).emit(
      'board:updated',
      updated
    );

    io?.to(`user:${board.project.ownerId}`).emit(
      'project:updated',
      {
        projectId: board.project.id,
        board: updated,
      }
    );

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

    // Pano silindiği için cache temizlenir
    await invalidateBoardCache(boardId);

    io?.to(`board:${boardId}`).emit(
      'board:deleted'
    );

    io?.to(`user:${board.project.ownerId}`).emit(
      'project:updated',
      board.project
    );

    for (const assigneeId of affectedAssigneeIds) {
      io?.to(`user:${assigneeId}`).emit(
        'project:updated'
      );

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