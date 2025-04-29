import { PrismaClient, RbacActions } from '@prisma/client';
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

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      actions: [
        RbacActions.DELETE_MESSAGE,
        RbacActions.DELETE_CHANNEL,
        RbacActions.DELETE_COMMUNITY,
        RbacActions.DELETE_INVITE,
        RbacActions.DELETE_USER,
        RbacActions.DELETE_ROLE,
        RbacActions.DELETE_ALIAS_GROUP,
        RbacActions.DELETE_ALIAS_GROUP_MEMBER,
        RbacActions.DELETE_INSTANCE_INVITE,
        RbacActions.DELETE_MEMBER,
        RbacActions.DELETE_REACTION,
        RbacActions.DELETE_ATTACHMENT,
        RbacActions.CREATE_MESSAGE,
        RbacActions.CREATE_CHANNEL,
        RbacActions.CREATE_COMMUNITY,
        RbacActions.CREATE_INVITE,
        RbacActions.CREATE_USER,
        RbacActions.CREATE_ROLE,
        RbacActions.CREATE_ALIAS_GROUP,
        RbacActions.CREATE_ALIAS_GROUP_MEMBER,
        RbacActions.CREATE_INSTANCE_INVITE,
        RbacActions.CREATE_MEMBER,
        RbacActions.CREATE_REACTION,
        RbacActions.CREATE_ATTACHMENT,
        RbacActions.READ_MESSAGE,
        RbacActions.READ_CHANNEL,
        RbacActions.READ_COMMUNITY,
        RbacActions.READ_USER,
        RbacActions.READ_ROLE,
        RbacActions.READ_ALIAS_GROUP,
        RbacActions.READ_ALIAS_GROUP_MEMBER,
        RbacActions.READ_INSTANCE_INVITE,
        RbacActions.READ_MEMBER,
      ],
    },
  });

  console.log({ adminRole });

  const modRole = await prisma.role.upsert({
    where: { name: 'moderator' },
    update: {},
    create: {
      name: 'moderator',
      actions: [
        RbacActions.DELETE_MESSAGE,
        RbacActions.DELETE_CHANNEL,
        RbacActions.DELETE_ALIAS_GROUP,
        RbacActions.DELETE_ALIAS_GROUP_MEMBER,
        RbacActions.DELETE_MEMBER,
        RbacActions.DELETE_REACTION,
        RbacActions.DELETE_ATTACHMENT,
        RbacActions.CREATE_MESSAGE,
        RbacActions.CREATE_CHANNEL,
        RbacActions.CREATE_ALIAS_GROUP,
        RbacActions.CREATE_ALIAS_GROUP_MEMBER,
        RbacActions.CREATE_MEMBER,
        RbacActions.CREATE_REACTION,
        RbacActions.CREATE_ATTACHMENT,
        RbacActions.READ_MESSAGE,
        RbacActions.READ_CHANNEL,
        RbacActions.READ_COMMUNITY,
        RbacActions.READ_USER,
        RbacActions.READ_ROLE,
        RbacActions.READ_ALIAS_GROUP,
        RbacActions.READ_ALIAS_GROUP_MEMBER,
        RbacActions.READ_MEMBER,
      ],
    },
  });
  console.log({ modRole });

  const community = await prisma.community.upsert({
    where: { name: 'default' },
    create: {
      name: 'default',
    },
    update: {},
  });
  console.log({ community });

  const member = await prisma.membership.upsert({
    where: {
      userId_communityId: {
        userId: admin.id,
        communityId: community.id,
      },
    },
    create: {
      userId: admin.id,
      communityId: community.id,
    },
    update: {},
  });
  console.log({ member });

  const channel = await prisma.channel.upsert({
    where: { communityId_name: { communityId: community.id, name: 'general' } },
    create: {
      name: 'general',
      communityId: community.id,
    },
    update: {},
  });
  console.log({ channel });
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
