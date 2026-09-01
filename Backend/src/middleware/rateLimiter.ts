import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redis from '../lib/redis';
import { AuthRequest } from './auth';

/**
 * NEDEN İKİ FARKLI RATE LIMIT STRATEJİSİ UYGULANIR?
 * 
 * 1. Auth Endpoint'leri (Login/Register) - IP Bazlı & Katı Limit:
 *    Henüz kullanıcının kimliği (JWT) doğrulanmadığı için IP adresi üzerinden takip edilir.
 *    Kaba kuvvet (brute-force) ve credential stuffing saldırılarını önlemek için çok dar bir limit uygulanır.
 * 
 * 2. Genel API Endpoint'leri - User ID Bazlı & Esnek Limit:
 *    Giriş yapmış kullanıcıların aynı IP'yi (örneğin ofis/okul NAT arkasında) paylaşması durumunda
 *    birbirlerini bloklamamaları için JWT içindeki userId baz alınır. Normal uygulama kullanım trafiğine
 *    izin verecek esneklikte tutulur.
 */

// 1. Auth için katı limiter: IP başına 15 dakikada (900 sn) en fazla 5 deneme
export const authRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_auth',
  points: 5, // İzin verilen maksimum istek sayısı
  duration: 900, // Zaman penceresi (saniye)
  blockDuration: 900, // Limit aşılırsa 15 dakika boyunca engelle
});

// 2. Genel API için esnek limiter: Kullanıcı (userId) başına dakikada (60 sn) en fazla 100 istek
export const apiRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_api',
  points: 100,
  duration: 60,
});

// Auth rotaları (Login/Register) için middleware
export const authLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    await authRateLimiter.consume(clientIp);
    next();
  } catch (rateLimiterRes) {
    return res.status(429).json({
      error: 'Çok fazla giriş denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.',
    });
  }
};

// Genel rotalar için middleware (JWT'den gelen userId kullanılır)
export const apiLimiterMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const key = req.userId || req.ip || 'general';
    await apiRateLimiter.consume(key);
    next();
  } catch (rateLimiterRes) {
    return res.status(429).json({
      error: 'İstek limitini aştınız. Lütfen bir süre sonra tekrar deneyin.',
    });
  }
};