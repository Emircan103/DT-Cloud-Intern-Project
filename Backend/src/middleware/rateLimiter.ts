import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import redis from '../lib/redis';
import { AuthRequest } from './auth';

// 1. Auth için katı limiter: IP başına 60 saniyede en fazla 5 deneme, aşılırsa 60 saniye engelle
export const authRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_auth',
  points: 5,
  duration: 60,
  blockDuration: 60,
});

// 2. Genel API için esnek limiter: Kullanıcı başına dakikada 100 istek
export const apiRateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'rl_api',
  points: 100,
  duration: 60,
});

// Auth rotaları (Login/Register) için middleware
export const authLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  try {
    const rateLimiterRes = await authRateLimiter.consume(clientIp);
    
    res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints);
    res.setHeader('X-RateLimit-Reset', Math.round(rateLimiterRes.msBeforeNext / 1000));
    
    next();
  } catch (rateLimiterRes: any) {
    const retrySecs = Math.max(1, Math.round((rateLimiterRes.msBeforeNext || 60000) / 1000));

    return res.status(429).json({
      error: `Çok fazla hatalı giriş denemesi yaptınız. Hesabınız geçici olarak kilitlendi. Lütfen ${retrySecs} saniye sonra tekrar deneyin.`,
      retryAfterSeconds: retrySecs,
    });
  }
};

// Genel rotalar için middleware
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