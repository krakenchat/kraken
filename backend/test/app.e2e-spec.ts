import * as request from 'supertest';
import { createE2eApp, E2eApp } from './helpers/e2e-app';

describe('App health (e2e)', () => {
  let app: E2eApp;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health reports ok with database and redis up', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      details: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });
});
