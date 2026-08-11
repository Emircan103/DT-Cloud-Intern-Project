import express from 'express'; //Web sunucusu ve API oluşturmak için kütüphane
import cors from 'cors'; // Frontend'in backende istek atabilmesini sağlayan kütüphane
import dotenv from 'dotenv'; //.env dosyasındaki değişkenleri kullanabilmek için kütüphane
import authRoutes from './routes/auth'; // Auth (kayıt/giriş) rotalarını içe aktarır

dotenv.config(); // .env dosyasındaki değişkenleri process.env üzerinden kullanabilmek için

const app = express(); // Express uygulamasını başlatır
const PORT = process.env.PORT || 5000; // Sunucunun çalışacağı port numarasını .env dosyasından alır, yoksa 5000 portunu kullanır

// Middleware (Ara katman yazılımları)
app.use(cors()); // Frontend'in istek atabilmesini sağlar
app.use(express.json()); // İsteklerden gelen JSON verisini okumamızı sağlar

// Auth Rotaları
app.use('/api/auth', authRoutes); // Kayıt ve giriş işlemlerini /api/auth altına bağlar

// Test Endpoint'i (HTTP GET)
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Sunucu çalışıyor!' 
  });
});

// Sunucuyu başlatır ve belirtilen portta dinlemeye başlar
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde yayında!`);
});