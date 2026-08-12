import { Router, Request, Response } from 'express';//Express.js, web uygulamaları ve API'ler oluşturmak için kullanılan bir Node.js framework'üdür.
import bcrypt from 'bcryptjs';//bcryptjs, şifreleri güvenli bir şekilde hashlemek ve doğrulamak için kullanılan bir kütüphanedir.
import jwt from 'jsonwebtoken';//jsonwebtoken, JSON Web Token (JWT) oluşturmak ve doğrulamak için kullanılan bir kütüphanedir.
import prisma from '../lib/prisma';//prisma, veritabanı işlemleri için kullanılan Prisma Client örneğini içe aktarır.

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'DEFAULT_JWT_PASSWORD';

// 1. Kayıt Ol (Register)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre zorunludur.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu email adresi zaten kullanımda.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);//Şifreyi güvenli bir şekilde hashler.

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    });

    return res.status(201).json({
      message: 'Kullanıcı başarıyla oluşturuldu.',
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Kayıt Hatası Detayı:', error); // Real error log
    return res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 2. Giriş Yap (Login)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre zorunludur.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Geçersiz email veya şifre.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Geçersiz email veya şifre.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.json({
      message: 'Giriş başarılı.',
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

export default router;