import { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis';

const CACHE_TTL = 3600; // 1 saat geçerlilik (saniye cinsinden)

// GET istekleri için cache middleware'i
export const cacheBoard = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const cacheKey = `board:${id}`;

  try {
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log(`⚡ [CACHE HIT] Board ${id} Redis'ten getirildi.`);
      return res.status(200).json(JSON.parse(cachedData));
    }

    console.log(`🐢 [CACHE MISS] Board ${id} Prisma'dan çekilecek.`);
    
    // Veritabanından gelen veriyi yakalayıp Redis'e kaydetmek için res.json'ı eziyoruz
    const originalJson = res.json.bind(res);
    res.json = (body: any): any => {
      // Sadece başarılı yanıtları cache'le
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redis.setex(cacheKey, CACHE_TTL, JSON.stringify(body));
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('Cache okuma hatası:', error);
    next(); // Redis çökse bile uygulama çalışmaya devam etsin
  }
};

// Herhangi bir mutation (yazma/silme) işleminde cache'i temizleyen fonksiyon
export const invalidateBoardCache = async (boardId: string) => {
  const cacheKey = `board:${boardId}`;
  await redis.del(cacheKey);
  console.log(`🧹 [CACHE CLEARED] Board ${boardId} önbelleği temizlendi.`);
};