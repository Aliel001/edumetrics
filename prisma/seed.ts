import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const teacherPassword = await bcrypt.hash('teacher123', 10);

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@edumetric.com' },
    update: {},
    create: {
      email: 'admin@edumetric.com',
      fullname: 'System Admin',
      password: adminPassword,
      role: 'admin',
    },
  });

  // Create Sample Teacher
  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@edumetric.com' },
    update: {},
    create: {
      email: 'teacher@edumetric.com',
      fullname: 'John Doe',
      password: teacherPassword,
      role: 'teacher',
    },
  });

  console.log({ admin, teacher });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
