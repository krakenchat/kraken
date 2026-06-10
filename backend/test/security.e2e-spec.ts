import * as request from 'supertest';
import { SENSITIVE_USER_FIELDS } from '@/test-utils/helpers/user-dto.helper';
import { DatabaseService } from '@/database/database.service';
import {
  createE2eApp,
  resetDatabase,
  seedInstanceInvite,
  registerUser,
  loginUser,
  E2eApp,
  E2E_INVITE_CODE,
} from './helpers/e2e-app';

/**
 * Defense-in-depth checks over the real HTTP pipeline:
 *  1. No user-bearing response in the auth/community/messaging flows leaks
 *     SENSITIVE_USER_FIELDS — responses are walked recursively.
 *  2. ValidationPipe whitelist strips unknown/excluded DTO properties
 *     end-to-end (mass-assignment protection).
 *
 * `createdAt` legitimately exists on non-user resources (Community, Role,
 * Channel, ...), so it is only treated as sensitive inside user objects
 * (top-level user responses and anything nested under a `user`/`author` key).
 * Every other SENSITIVE_USER_FIELDS key is forbidden anywhere in any response.
 */
const GLOBALLY_FORBIDDEN: readonly string[] = SENSITIVE_USER_FIELDS.filter(
  (f) => f !== 'createdAt',
);

const USER_OBJECT_KEYS = ['user', 'author', 'createdBy'];

function findLeaks(
  value: unknown,
  path = '$',
  insideUserObject = false,
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      findLeaks(item, `${path}[${i}]`, insideUserObject),
    );
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }

  const forbidden: readonly string[] = insideUserObject
    ? SENSITIVE_USER_FIELDS
    : GLOBALLY_FORBIDDEN;

  const leaks: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.includes(key)) {
      leaks.push(`${path}.${key}`);
    }
    leaks.push(
      ...findLeaks(
        child,
        `${path}.${key}`,
        insideUserObject || USER_OBJECT_KEYS.includes(key),
      ),
    );
  }
  return leaks;
}

function expectNoSensitiveLeaks(body: unknown, isUserObject = false): void {
  expect(findLeaks(body, '$', isUserObject)).toEqual([]);
}

describe('Security (e2e)', () => {
  let app: E2eApp;

  const owner = {
    username: 'e2e-sec-owner',
    password: 'Password123!',
    email: 'e2e-sec-owner@test.local',
  };
  const member = {
    username: 'e2e-sec-member',
    password: 'Password123!',
    email: 'e2e-sec-member@test.local',
  };

  let ownerToken: string;
  let communityId: string;
  let channelId: string;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
    await seedInstanceInvite(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sensitive user field exclusion across real flows', () => {
    it('registration response leaks no sensitive fields', async () => {
      const ownerBody = await registerUser(app, owner);
      expectNoSensitiveLeaks(ownerBody, true);
      ownerToken = (await loginUser(app, owner.username, owner.password))
        .accessToken;
    });

    it('login response leaks no sensitive fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ username: owner.username, password: owner.password })
        .expect(200);
      expectNoSensitiveLeaks(res.body);
    });

    it('profile and user lookup responses leak no sensitive fields', async () => {
      const profile = await request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expectNoSensitiveLeaks(profile.body, true);

      const byName = await request(app.getHttpServer())
        .get(`/api/users/username/${owner.username}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expectNoSensitiveLeaks(byName.body, true);
    });

    it('community, channel and membership responses leak no sensitive fields', async () => {
      const community = await request(app.getHttpServer())
        .post('/api/community')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'E2E Security Community' })
        .expect(201);
      expectNoSensitiveLeaks(community.body);
      communityId = (community.body as { id: string }).id;

      const channel = await request(app.getHttpServer())
        .post('/api/channels')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'e2e-sec-channel',
          communityId,
          type: 'TEXT',
          isPrivate: false,
        })
        .expect(201);
      expectNoSensitiveLeaks(channel.body);
      channelId = (channel.body as { id: string }).id;

      const channels = await request(app.getHttpServer())
        .get(`/api/channels/community/${communityId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expectNoSensitiveLeaks(channels.body);

      // Membership listing embeds user objects — the highest-risk response
      const members = await request(app.getHttpServer())
        .get(`/api/membership/community/${communityId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expect(Array.isArray(members.body)).toBe(true);
      expect((members.body as unknown[]).length).toBeGreaterThan(0);
      expectNoSensitiveLeaks(members.body);
    });

    it('message create and list responses leak no sensitive fields', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/messages')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId,
          spans: [
            {
              type: 'PLAINTEXT',
              text: 'security spec message',
              userId: null,
              specialKind: null,
              communityId: null,
              aliasId: null,
            },
          ],
          attachments: [],
        })
        .expect(201);
      expectNoSensitiveLeaks(created.body);

      const listed = await request(app.getHttpServer())
        .get(`/api/messages/channel/${channelId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      expectNoSensitiveLeaks(listed.body);
    });
  });

  describe('ValidationPipe whitelist (mass-assignment protection)', () => {
    it('strips unknown and excluded properties from message creation', async () => {
      const text = 'whitelist probe';
      const res = await request(app.getHttpServer())
        .post('/api/messages')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          channelId,
          spans: [
            {
              type: 'PLAINTEXT',
              text,
              userId: null,
              specialKind: null,
              communityId: null,
              aliasId: null,
            },
          ],
          attachments: [],
          // Unknown property — must be silently stripped by whitelist
          injectedField: 'evil',
          // @Exclude()'d / server-controlled properties — must not be honored
          pinned: true,
          searchText: 'attacker-controlled search text',
        })
        .expect(201);

      const body = res.body as { id: string; pinned: boolean };
      expect(res.body).not.toHaveProperty('injectedField');
      expect(body.pinned).toBe(false);

      // Verify at the database level that nothing leaked through
      const db = app.get(DatabaseService);
      const stored = await db.message.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(stored.pinned).toBe(false);
      expect(stored.searchText).toBe(text);
    });

    it('ignores an attempted instance role escalation during registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/users')
        .send({
          code: E2E_INVITE_CODE,
          ...member,
          // Not part of CreateUserDto — whitelist must strip it
          role: 'OWNER',
        })
        .expect(201);

      expect((res.body as { role: string }).role).toBe('USER');
      expectNoSensitiveLeaks(res.body, true);
    });
  });
});
