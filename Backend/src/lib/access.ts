import { prisma } from './prisma';
import { getIO } from './socket';

/**
 * Bir görev silindiğinde veya başka birine devredildiğinde çağrılır.
 * Eski atanan kişi (proje sahibi değilse) o projede artık hiç görevi kalmadıysa
 * `access:revoked` sinyali göndererek anlık olarak proje listesine yönlendirilmesini sağlar.
 * Ayrıca proje sahibinin erişimi bu şekilde asla kesilmez.
 */
export const notifyIfProjectAccessLost = async (
  userId: string | null | undefined,
  projectId: string | null | undefined
): Promise<void> => {
  if (!userId || !projectId) return;

  const io = getIO();
  if (!io) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  // Proje bulunamadıysa ya da kullanıcı zaten proje sahibiyse yapacak bir şey yok
  if (!project || project.ownerId === userId) return;

  const remainingTasks = await prisma.task.count({
    where: {
      assigneeId: userId,
      column: { board: { projectId } },
    },
  });

  if (remainingTasks === 0) {
    io.to(`user:${userId}`).emit('access:revoked', { projectId });
  }
};