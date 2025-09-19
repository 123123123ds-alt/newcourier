import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = 'admin@newcourier.test';
  const password = 'Password123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        role: Role.ADMIN,
        isActive: true,
        passwordHash,
        name: existing.name ?? 'Administrator'
      }
    });
    console.info('✅ Admin user updated');
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Administrator',
      role: Role.ADMIN,
      isActive: true
    }
  });
  console.info('✅ Admin user created');
}

void main()
  .catch((error) => {
    console.error('❌ Seeding failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
