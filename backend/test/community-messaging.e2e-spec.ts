import * as request from 'supertest';
import { DatabaseService } from '@/database/database.service';
import {
  createE2eApp,
  resetDatabase,
  seedInstanceInvite,
  registerUser,
  loginUser,
  E2eApp,
} from './helpers/e2e-app';

/**
 * Community → channel → message lifecycle against real Postgres + Redis,
 * including default role bootstrap and RBAC enforcement through the real
 * guard chain (JwtAuthGuard → RbacGuard).
 *
 * owner: first registered user → InstanceRole.OWNER (may create communities;
 *        rbac.guard.ts short-circuits OWNER).
 * outsider: second registered user → InstanceRole.USER with NO membership in
 *        the community — must be denied by RbacGuard.
 */
describe('Community messaging flow (e2e)', () => {
  let app: E2eApp;

  const owner = {
    username: 'e2e-owner',
    password: 'Password123!',
    email: 'e2e-owner@test.local',
  };
  const outsider = {
    username: 'e2e-outsider',
    password: 'Password123!',
    email: 'e2e-outsider@test.local',
  };

  let ownerToken: string;
  let outsiderToken: string;
  let communityId: string;
  let channelId: string;

  const MESSAGE_TEXT = 'hello from the e2e suite';

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
    await seedInstanceInvite(app);

    await registerUser(app, owner); // first → OWNER
    await registerUser(app, outsider); // second → USER

    ownerToken = (await loginUser(app, owner.username, owner.password))
      .accessToken;
    outsiderToken = (await loginUser(app, outsider.username, outsider.password))
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a community', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/community')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Community', description: 'Created by e2e tests' })
      .expect(201);

    const body = res.body as { id: string; name: string };
    expect(body).toMatchObject({
      name: 'E2E Community',
      description: 'Created by e2e tests',
    });
    expect(typeof body.id).toBe('string');
    communityId = body.id;
  });

  it('bootstraps the default community roles with positions 10/20/100', async () => {
    const db = app.get(DatabaseService);
    const roles = await db.role.findMany({
      where: { communityId },
      orderBy: { position: 'asc' },
    });

    expect(roles.map((r) => ({ name: r.name, position: r.position }))).toEqual([
      { name: 'Community Admin', position: 10 },
      { name: 'Moderator', position: 20 },
      { name: 'Member', position: 100 },
    ]);
    expect(roles.every((r) => r.isDefault)).toBe(true);
  });

  it('creates a text channel in the community', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/channels')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'e2e-general',
        communityId,
        type: 'TEXT',
        isPrivate: false,
      })
      .expect(201);

    const body = res.body as { id: string; name: string };
    expect(body).toMatchObject({
      name: 'e2e-general',
      communityId,
      type: 'TEXT',
      isPrivate: false,
    });
    expect(typeof body.id).toBe('string');
    channelId = body.id;
  });

  it('sends a message to the channel', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        channelId,
        spans: [
          {
            type: 'PLAINTEXT',
            text: MESSAGE_TEXT,
            userId: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
        attachments: [],
      })
      .expect(201);

    const body = res.body as {
      id: string;
      spans: Array<{ type: string; text: string | null }>;
    };
    expect(body).toMatchObject({
      channelId,
      pinned: false,
      reactions: [],
    });
    expect(typeof body.id).toBe('string');
    expect(body.spans).toHaveLength(1);
    expect(body.spans[0]).toMatchObject({
      type: 'PLAINTEXT',
      text: MESSAGE_TEXT,
    });
  });

  it('lists channel messages with span content', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/messages/channel/${channelId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const body = res.body as {
      messages: Array<{
        channelId: string | null;
        spans: Array<{ type: string; text: string | null }>;
      }>;
    };
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(1);

    const message = body.messages[0];
    expect(message).toMatchObject({ channelId });
    expect(message.spans).toHaveLength(1);
    expect(message.spans[0]).toMatchObject({
      type: 'PLAINTEXT',
      text: MESSAGE_TEXT,
    });
  });

  it('denies channel message reads to a non-member through the real guard chain', async () => {
    await request(app.getHttpServer())
      .get(`/api/messages/channel/${channelId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it('denies message creation to a non-member', async () => {
    await request(app.getHttpServer())
      .post('/api/messages')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        channelId,
        spans: [
          {
            type: 'PLAINTEXT',
            text: 'should never land',
            userId: null,
            specialKind: null,
            communityId: null,
            aliasId: null,
          },
        ],
        attachments: [],
      })
      .expect(403);
  });
});
