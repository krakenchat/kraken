import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@admin.fake' },
    update: {},
    create: {
      email: 'admin@admin.fake',
      username: 'admin',
      displayName: 'Admin',
      role: 'OWNER',
      hashedPassword: bcrypt.hashSync('admin', 10),
      verified: true,
    },
  });
  console.log({ admin });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
