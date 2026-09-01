import Redis from 'ioredis';

// Localhost üzerinde standart Redis portu (6379) ile bağlantı
const redis = new Redis({
  host: '127.0.0.1',
  port: 6379,
});

redis.on('connect', () => {
  console.log('📦 Redis bağlantısı başarılı.');
});

redis.on('error', (err) => {
  console.error('❌ Redis bağlantı hatası:', err);
});

export default redis;