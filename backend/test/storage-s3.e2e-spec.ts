/**
 * Integration test for the S3 storage provider against a REAL MinIO
 * instance.
 *
 * Requires MinIO running and reachable (the dev Docker Compose stack ships
 * a `minio` service behind an opt-in profile):
 *
 *   docker compose --profile s3 up -d minio minio-init
 *   docker compose run --rm -e E2E_ALLOW_DB_RESET=1 backend pnpm run test:e2e -- storage-s3
 *
 * This spec overrides STORAGE_TYPE and the S3_* vars in `process.env` for
 * its own AppModule instance only, restoring the previous values in
 * `afterAll` — the e2e suite runs with `maxWorkers: 1` (see
 * test/jest-e2e.json), so test FILES execute sequentially in one process
 * and a leaked env var here would otherwise bleed into specs that assume
 * the default LOCAL behavior.
 *
 * S3_ENDPOINT/S3_BUCKET can be overridden via S3_TEST_ENDPOINT /
 * S3_TEST_BUCKET if your MinIO isn't reachable at the Compose defaults.
 */
import * as request from 'supertest';
import {
  createE2eApp,
  resetDatabase,
  seedInstanceInvite,
  registerUser,
  loginUser,
  E2eApp,
} from './helpers/e2e-app';

const PREVIOUS_ENV: Record<string, string | undefined> = {};
const S3_ENV: Record<string, string> = {
  STORAGE_TYPE: 'S3',
  S3_BUCKET: process.env.S3_TEST_BUCKET ?? 'semaphore-dev',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'minioadmin',
  S3_SECRET_ACCESS_KEY: 'minioadmin',
  S3_ENDPOINT: process.env.S3_TEST_ENDPOINT ?? 'http://minio:9000',
  S3_FORCE_PATH_STYLE: 'true',
};

// 1x1 transparent PNG — small, valid magic bytes (passes the image
// content-sniffing check in ResourceTypeFileValidator).
const PNG_FIXTURE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe('Storage (S3/MinIO) e2e', () => {
  let app: E2eApp;

  beforeAll(async () => {
    for (const key of Object.keys(S3_ENV)) {
      PREVIOUS_ENV[key] = process.env[key];
    }
    Object.assign(process.env, S3_ENV);

    app = await createE2eApp();
    await resetDatabase(app);
    await seedInstanceInvite(app);
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of Object.entries(PREVIOUS_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('round-trips an image upload through S3 storage: upload -> serve (full + ranged) -> soft delete', async () => {
    const username = 'e2e-s3-user';
    const password = 'Password123!';

    const user = await registerUser(app, { username, password });
    const { accessToken } = await loginUser(app, username, password);

    const uploadRes = await request(app.getHttpServer())
      .post('/api/file-upload')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('resourceType', 'USER_AVATAR')
      .field('resourceId', user.id)
      .attach('file', PNG_FIXTURE, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    const uploadBody = uploadRes.body as { id: string; storageType: string };
    const fileId = uploadBody.id;
    expect(fileId).toBeDefined();
    // Per-record resolution depends on this being persisted correctly.
    expect(uploadBody.storageType).toBe('S3');
    // storagePath (the S3 key) is excluded from the response DTO — only
    // storageType is asserted here; the real key is verified indirectly
    // by the serve requests below succeeding against the real bucket.

    // Serve path: full object, streamed back from MinIO through the backend.
    const getRes = await request(app.getHttpServer())
      .get(`/api/file/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(getRes.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(getRes.body as Buffer, PNG_FIXTURE)).toBe(0);

    // Ranged read: S3 GetObject Range param must be honored end-to-end.
    const rangeRes = await request(app.getHttpServer())
      .get(`/api/file/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Range', 'bytes=0-9')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(206);

    expect(rangeRes.headers['content-range']).toBe(
      `bytes 0-9/${PNG_FIXTURE.length}`,
    );
    expect((rangeRes.body as Buffer).length).toBe(10);
    expect(
      Buffer.compare(rangeRes.body as Buffer, PNG_FIXTURE.subarray(0, 10)),
    ).toBe(0);

    // Delete path: soft-delete via the API (physical S3 object cleanup runs
    // on FileService's cron — covered by file.service.spec.ts unit tests).
    await request(app.getHttpServer())
      .delete(`/api/file-upload/${fileId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });
});
