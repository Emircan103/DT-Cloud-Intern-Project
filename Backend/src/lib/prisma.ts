import { PrismaClient } from '@prisma/client';//PrismaClient, uygulamanın Prisma üzerinden veritabanı sorguları ve işlemleri yapmasını sağlayan sınıftır.
import { PrismaPg } from '@prisma/adapter-pg';//PrismaPg, Prisma'nın PostgreSQL bağlantısı için kullandığı adaptördür.
import { Pool } from 'pg';//Node.js için PostgreSQL istemcisi olan 'pg' kütüphanesinden Pool sınıfını içe aktarır. Bu sınıf, veritabanı bağlantı havuzlarını yönetmek için kullanılır.
import dotenv from 'dotenv';//.env dosyasındaki ortam değişkenlerini yüklemek için kullanılan bir kütüphanedir.

dotenv.config();//.env dosyası okunur

//DATABASE_URL kullanılarak PostgreSQL için bir bağlantı havuzu (Pool) oluşturulur.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);//PrismaPg adaptörü, oluşturulan PostgreSQL Pool bağlantısını Prisma'ya bağlamak için kullanılır.

const globalForPrisma = global as unknown as { prisma: PrismaClient };// global nesnesini, prisma özelliğine sahip bir nesne olarak TypeScript'e tanıtır.
export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });// Global'de mevcut bir PrismaClient varsa onu kullanır, yoksa yeni bir tane oluşturur.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;// Production dışındaki ortamlarda PrismaClient global nesnesine kaydedilir.

export default prisma;// prisma nesnesini bu dosyanın varsayılan export'u olarak dışarı aktarır.