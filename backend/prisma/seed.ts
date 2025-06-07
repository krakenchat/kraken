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

  await Promise.all(
    ['bob', 'alice', 'charlie', 'john', 'sally', 'joe', 'todd'].map(
      (username) =>
        prisma.user.upsert({
          where: { email: `${username}@fake.com` },
          update: {},
          create: {
            email: `${username}@fake.com`,
            username,
            displayName: username.charAt(0).toUpperCase() + username.slice(1),
            role: 'USER',
            hashedPassword: bcrypt.hashSync('password', 10),
            verified: true,
          },
        }),
    ),
  );

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
      description: 'This is a default test community',
    },
    update: {},
  });
  console.log({ community });

  // Create community-specific roles
  const communityAdminRole = await prisma.role.upsert({
    where: { name: `Community Admin - ${community.id}` },
    update: {},
    create: {
      name: `Community Admin - ${community.id}`,
      actions: [
        RbacActions.UPDATE_COMMUNITY,
        RbacActions.DELETE_COMMUNITY,
        RbacActions.READ_COMMUNITY,
        RbacActions.CREATE_CHANNEL,
        RbacActions.UPDATE_CHANNEL,
        RbacActions.DELETE_CHANNEL,
        RbacActions.READ_CHANNEL,
        RbacActions.CREATE_MEMBER,
        RbacActions.UPDATE_MEMBER,
        RbacActions.DELETE_MEMBER,
        RbacActions.READ_MEMBER,
        RbacActions.CREATE_MESSAGE,
        RbacActions.DELETE_MESSAGE,
        RbacActions.READ_MESSAGE,
        RbacActions.CREATE_ROLE,
        RbacActions.UPDATE_ROLE,
        RbacActions.DELETE_ROLE,
        RbacActions.READ_ROLE,
        RbacActions.CREATE_INVITE,
        RbacActions.DELETE_INVITE,
        RbacActions.READ_INSTANCE_INVITE,
        RbacActions.CREATE_ALIAS_GROUP,
        RbacActions.UPDATE_ALIAS_GROUP,
        RbacActions.DELETE_ALIAS_GROUP,
        RbacActions.READ_ALIAS_GROUP,
        RbacActions.CREATE_ALIAS_GROUP_MEMBER,
        RbacActions.DELETE_ALIAS_GROUP_MEMBER,
        RbacActions.READ_ALIAS_GROUP_MEMBER,
        RbacActions.CREATE_REACTION,
        RbacActions.DELETE_REACTION,
        RbacActions.CREATE_ATTACHMENT,
        RbacActions.DELETE_ATTACHMENT,
      ],
    },
  });
  console.log({ communityAdminRole });

  const communityModeratorRole = await prisma.role.upsert({
    where: { name: `Moderator - ${community.id}` },
    update: {},
    create: {
      name: `Moderator - ${community.id}`,
      actions: [
        RbacActions.READ_COMMUNITY,
        RbacActions.READ_CHANNEL,
        RbacActions.READ_MEMBER,
        RbacActions.READ_MESSAGE,
        RbacActions.READ_ROLE,
        RbacActions.CREATE_MESSAGE,
        RbacActions.DELETE_MESSAGE,
        RbacActions.CREATE_CHANNEL,
        RbacActions.UPDATE_CHANNEL,
        RbacActions.CREATE_MEMBER,
        RbacActions.UPDATE_MEMBER,
        RbacActions.CREATE_REACTION,
        RbacActions.DELETE_REACTION,
        RbacActions.CREATE_ATTACHMENT,
        RbacActions.DELETE_ATTACHMENT,
        RbacActions.READ_ALIAS_GROUP,
        RbacActions.READ_ALIAS_GROUP_MEMBER,
      ],
    },
  });
  console.log({ communityModeratorRole });

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

  // Assign admin user to the community admin role
  const adminUserRole = await prisma.userRoles.upsert({
    where: {
      userId_communityId_roleId: {
        userId: admin.id,
        communityId: community.id,
        roleId: communityAdminRole.id,
      },
    },
    create: {
      userId: admin.id,
      communityId: community.id,
      roleId: communityAdminRole.id,
      isInstanceRole: false,
    },
    update: {},
  });
  console.log({ adminUserRole });

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
