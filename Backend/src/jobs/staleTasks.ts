import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { invalidateBoardCache } from '../middleware/cache';

// Testleri kolay gözlemlemek için eşik: 10 dakika
const STALE_THRESHOLD_MINUTES = 10;

export const initStaleTaskJob = () => {
  // Her 2 dakikada bir çalışır
  cron.schedule('*/2 * * * *', async () => {
    console.log('⏰ [CRON JOB] Bekleyen (stale) görev taraması başladı...');

    try {
      const thresholdDate = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

      // Panonun ilk kolonundaki bayatlamamış görevleri ve proje sahibini getir
      const staleTasks = await prisma.task.findMany({
        where: {
          isStale: false,
          createdAt: {
            lte: thresholdDate,
          },
          column: {
            order: 0,
          },
        },
        include: {
          column: {
            select: {
              boardId: true,
              board: {
                select: {
                  project: {
                    select: { ownerId: true },
                  },
                },
              },
            },
          },
        },
      });

      if (staleTasks.length === 0) {
        console.log('⏰ [CRON JOB] Yeni bayatlayan (stale) görev bulunamadı.');
        return;
      }

      console.log(`⏰ [CRON JOB] ${staleTasks.length} adet görev 'stale' olarak işaretleniyor...`);

      const affectedBoardIds = new Set<string>();

      for (const task of staleTasks) {
        await prisma.task.update({
          where: { id: task.id },
          data: { isStale: true },
        });

        // userId zorunlu olduğu için task'ın atanan kişisini veya proje sahibinin ID'sini veriyoruz
        const logUserId = task.assigneeId || task.column.board.project.ownerId;

        await prisma.activityLog.create({
          data: {
            action: 'TASK_UPDATED',
            taskId: task.id,
            userId: logUserId,
          },
        });

        affectedBoardIds.add(task.column.boardId);
      }

      for (const boardId of affectedBoardIds) {
        await invalidateBoardCache(boardId);
      }

      console.log('✅ [CRON JOB] Bekleyen görevler güncellendi ve önbellek temizlendi.');
    } catch (error) {
      console.error('❌ [CRON JOB] Hata oluştu:', error);
    }
  });

  console.log('🚀 [CRON JOB] Stale task zamanlayıcısı aktif edildi (Her 2 dakikada bir).');
};