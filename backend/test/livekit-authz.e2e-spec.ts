import * as request from 'supertest';
import {
  createE2eApp,
  resetDatabase,
  seedInstanceInvite,
  registerUser,
  loginUser,
  E2eApp,
  RegisteredUser,
} from './helpers/e2e-app';

/**
 * Direct authorization coverage for the LiveKit token + DM voice-presence
 * endpoints through the REAL guard chain (JwtAuthGuard -> RbacGuard ->
 * PermissionsService -> Postgres). Previously this gating was only proven
 * transitively via permissions.service.spec.ts.
 *
 * Covers:
 *  - POST /api/livekit/token      (CHANNEL resource, JOIN_CHANNEL)
 *  - POST /api/livekit/dm-token   (DM_GROUP resource, READ_MESSAGE)
 *  - GET  /api/dm-groups/:id/voice-presence          (DM membership required)
 *  - POST /api/dm-groups/:id/voice-presence/refresh  (DM membership required)
 *  - CreateTokenDto ttl cap (@Max(3600)) end-to-end via ValidationPipe
 *
 * The instance owner bypasses RBAC (rbac.guard.ts short-circuit), so the
 * owner account is used only for setup; the actual assertions use regular
 * InstanceRole.USER accounts.
 */

// LiveKit credentials are not part of the CI e2e environment (no LiveKit
// server is needed — AccessToken generation is pure JWT signing). Provide
// dev-style defaults without overriding a configured environment.
process.env.LIVEKIT_API_KEY ??= 'devkey';
process.env.LIVEKIT_API_SECRET ??=
  'e2e-secret-that-is-at-least-32-characters-long';
process.env.LIVEKIT_URL ??= 'ws://localhost:7880';

describe('LiveKit token & DM voice-presence authorization (e2e)', () => {
  let app: E2eApp;

  const owner = {
    username: 'e2e-lk-owner',
    password: 'Password123!',
    email: 'e2e-lk-owner@test.local',
  };
  const memberA = {
    username: 'e2e-lk-member-a',
    password: 'Password123!',
    email: 'e2e-lk-member-a@test.local',
  };
  const memberB = {
    username: 'e2e-lk-member-b',
    password: 'Password123!',
    email: 'e2e-lk-member-b@test.local',
  };
  const outsider = {
    username: 'e2e-lk-outsider',
    password: 'Password123!',
    email: 'e2e-lk-outsider@test.local',
  };

  let ownerToken: string;
  let memberAToken: string;
  let memberBToken: string;
  let outsiderToken: string;

  let memberAUser: RegisteredUser;
  let memberBUser: RegisteredUser;

  let communityId: string;
  let voiceChannelId: string;
  let dmGroupId: string;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
    await seedInstanceInvite(app);

    await registerUser(app, owner); // first -> InstanceRole.OWNER
    memberAUser = await registerUser(app, memberA);
    memberBUser = await registerUser(app, memberB);
    await registerUser(app, outsider);

    ownerToken = (await loginUser(app, owner.username, owner.password))
      .accessToken;
    memberAToken = (await loginUser(app, memberA.username, memberA.password))
      .accessToken;
    memberBToken = (await loginUser(app, memberB.username, memberB.password))
      .accessToken;
    outsiderToken = (await loginUser(app, outsider.username, outsider.password))
      .accessToken;

    // Owner creates a community with a voice channel and adds memberA
    // (memberA receives the default "Member" role, which grants JOIN_CHANNEL).
    const community = await request(app.getHttpServer())
      .post('/api/community')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E LiveKit Community' })
      .expect(201);
    communityId = (community.body as { id: string }).id;

    await request(app.getHttpServer())
      .post('/api/membership')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ userId: memberAUser.id, communityId })
      .expect(201);

    const channel = await request(app.getHttpServer())
      .post('/api/channels')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'e2e-lk-voice',
        communityId,
        type: 'VOICE',
        isPrivate: false,
      })
      .expect(201);
    voiceChannelId = (channel.body as { id: string }).id;

    // memberA opens a DM group with memberB; the outsider is not a member.
    const dmGroup = await request(app.getHttpServer())
      .post('/api/direct-messages')
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({ userIds: [memberBUser.id] })
      .expect(201);
    dmGroupId = (dmGroup.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/livekit/token (channel rooms)', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/token')
        .send({ identity: 'ignored', roomId: voiceChannelId })
        .expect(401);
    });

    it('denies a user who is not a member of the channel community', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/token')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ identity: 'ignored', roomId: voiceChannelId })
        .expect(403);
    });

    it('issues a token to a community member with JOIN_CHANNEL', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/livekit/token')
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({ identity: 'ignored', roomId: voiceChannelId })
        .expect(201);

      const body = res.body as {
        token: string;
        identity: string;
        roomId: string;
      };
      expect(typeof body.token).toBe('string');
      expect(body.roomId).toBe(voiceChannelId);
      // Identity must be the authenticated user, not the client-sent value
      expect(body.identity).toBe(memberAUser.id);
    });
  });

  describe('CreateTokenDto ttl cap', () => {
    it('rejects a ttl above 3600 seconds (lingering-access bound)', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/token')
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({ identity: 'ignored', roomId: voiceChannelId, ttl: 999999 })
        .expect(400);
    });

    it('accepts a ttl at the 3600 second cap', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/token')
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({ identity: 'ignored', roomId: voiceChannelId, ttl: 3600 })
        .expect(201);
    });

    it('applies the same cap to dm-token', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/dm-token')
        .set('Authorization', `Bearer ${memberAToken}`)
        .send({ identity: 'ignored', roomId: dmGroupId, ttl: 999999 })
        .expect(400);
    });
  });

  describe('POST /api/livekit/dm-token (DM rooms)', () => {
    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/dm-token')
        .send({ identity: 'ignored', roomId: dmGroupId })
        .expect(401);
    });

    it('denies a user who is not a member of the DM group', async () => {
      await request(app.getHttpServer())
        .post('/api/livekit/dm-token')
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ identity: 'ignored', roomId: dmGroupId })
        .expect(403);
    });

    it('issues a token to a DM group member', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/livekit/dm-token')
        .set('Authorization', `Bearer ${memberBToken}`)
        .send({ identity: 'ignored', roomId: dmGroupId })
        .expect(201);

      const body = res.body as { token: string; identity: string };
      expect(typeof body.token).toBe('string');
      expect(body.identity).toBe(memberBUser.id);
    });
  });

  describe('DM voice-presence endpoints (membership required)', () => {
    it('rejects unauthenticated presence reads', async () => {
      await request(app.getHttpServer())
        .get(`/api/dm-groups/${dmGroupId}/voice-presence`)
        .expect(401);
    });

    it('denies presence reads to a non-member of the DM group', async () => {
      await request(app.getHttpServer())
        .get(`/api/dm-groups/${dmGroupId}/voice-presence`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('denies presence refresh to a non-member of the DM group', async () => {
      await request(app.getHttpServer())
        .post(`/api/dm-groups/${dmGroupId}/voice-presence/refresh`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(403);
    });

    it('allows a DM member to refresh and read presence', async () => {
      await request(app.getHttpServer())
        .post(`/api/dm-groups/${dmGroupId}/voice-presence/refresh`)
        .set('Authorization', `Bearer ${memberAToken}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/dm-groups/${dmGroupId}/voice-presence`)
        .set('Authorization', `Bearer ${memberAToken}`)
        .expect(200);

      const body = res.body as {
        dmGroupId: string;
        users: Array<{ id: string }>;
        count: number;
      };
      expect(body.dmGroupId).toBe(dmGroupId);
      // The refresh above re-registered memberA (expired-key path), so the
      // member appears in the presence list the REST read path returns.
      expect(body.users.map((u) => u.id)).toContain(memberAUser.id);
    });
  });
});
